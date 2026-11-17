"""All network and credential input is mocked: these tests cannot buy synthesis."""

import base64
from contextlib import redirect_stderr, redirect_stdout
import getpass
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error
import warnings
import wave

import speechkit as sk


SECRET = "dummy-test-key-DO-NOT-USE"
PCM = b"\x00\x00" * 2205


def stream(*chunks):
    return b"\n".join(json.dumps({"result": {"audioChunk": {
        "data": base64.b64encode(chunk).decode("ascii")
    }}}).encode() for chunk in chunks)


class SpeechkitTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.cache = Path(self.directory.name) / "cache"
        self.manifest = Path(self.directory.name) / "sample.json"
        self.clips = [{"id": "sample", "text": "Что означает слово кринж?"}]
        self.write_manifest(self.clips)
        # A real request is forbidden even if a test forgets to stub synthesize.
        self.network = patch.object(sk.urllib.request, "build_opener").start()
        self.network.side_effect = AssertionError("Unexpected network access")
        self.addCleanup(patch.stopall)

    def write_manifest(self, clips):
        self.manifest.write_text(json.dumps({"clips": clips}), encoding="utf-8")

    def run_cli(self, *args):
        output = io.StringIO()
        with redirect_stdout(output), redirect_stderr(output):
            status = sk.main(["--manifest", str(self.manifest), "--cache-dir", str(self.cache), *args])
        self.assertNotIn(SECRET, output.getvalue())
        return status, output.getvalue()

    def seed_cache(self):
        self.cache.mkdir(exist_ok=True)
        payload = sk.make_payload(self.clips[0]["text"])
        key = sk.request_hash(payload)
        sk.save_recording(self.cache, key, payload, sk.decode_response(stream(PCM)))
        return key

    def test_default_estimate_never_prompts_or_writes(self):
        with patch.object(sk, "read_key") as read, patch("builtins.input") as confirm:
            status, output = self.run_cli()
        self.assertEqual(status, 0)
        self.assertIn("0.1626", output)
        self.assertFalse(self.cache.exists())
        read.assert_not_called()
        confirm.assert_not_called()
        self.network.assert_not_called()

    def test_payload_uses_v3_oneof_hints_and_pcm(self):
        payload = sk.make_payload("Привет!")
        self.assertEqual(payload["hints"], [{"voice": "alexander"}, {"role": "neutral"}, {"speed": 1.0}])
        self.assertFalse(payload["unsafeMode"])
        self.assertNotIn("model", payload)  # documented default general
        self.assertEqual(payload["outputAudioSpec"]["rawAudio"]["audioEncoding"], "LINEAR16_PCM")
        for bad in ["", "  ", "а" * 250, None]:
            with self.subTest(bad=type(bad)):
                with self.assertRaises(sk.UserError):
                    sk.make_payload(bad)
        sk.make_payload("а" * 249)

    def test_malformed_manifests_stop_before_credentials(self):
        for clips in [[], [{"id": "../bad", "text": "test"}], self.clips * 2,
                      [{"id": "sample", "text": "t", "apiKey": SECRET}]]:
            with self.subTest(clips=len(clips)):
                self.write_manifest(clips)
                self.assertEqual(self.run_cli("--synthesize")[0], 1)
        self.network.assert_not_called()

    def test_budget_and_cancel_stop_before_key(self):
        self.write_manifest(self.clips + [{"id": "other", "text": "Ещё текст"}])
        with patch.object(sk, "read_key") as read, patch("builtins.input") as confirm:
            self.assertEqual(self.run_cli("--synthesize")[0], 1)
            read.assert_not_called()
            confirm.assert_not_called()
        self.write_manifest(self.clips)
        with patch.object(sk.sys.stdin, "isatty", return_value=True), \
                patch.object(sk, "read_key") as read, patch("builtins.input", return_value=""), \
                patch.object(sk.sys, "stderr", Mock(isatty=lambda: True)), redirect_stdout(io.StringIO()):
            sk.generate(self.clips, self.cache, sk.PRICE)
            read.assert_not_called()
        self.network.assert_not_called()

    def test_noninteractive_synthesis_refuses_key(self):
        with patch.object(sk, "read_key") as read:
            self.assertEqual(self.run_cli("--synthesize")[0], 1)
            read.assert_not_called()

    def test_hidden_input_and_no_echo_fallback(self):
        with patch.object(sk.sys.stdin, "isatty", return_value=True), \
                patch.object(sk.sys.stderr, "isatty", return_value=True), \
                patch.object(sk.getpass, "getpass", return_value=SECRET) as hidden:
            self.assertEqual(sk.read_key(), SECRET)
            hidden.assert_called_once()
            def unavailable(*args):
                warnings.warn("echo unavailable", getpass.GetPassWarning)
                self.fail("must abort before fallback reads input")
            hidden.side_effect = unavailable
            with self.assertRaises(sk.UserError):
                sk.read_key()
            hidden.side_effect = None
            hidden.return_value = "invalid\r\nvalue"
            with self.assertRaises(sk.UserError):
                sk.read_key()

    def test_streamed_chunks_decode_into_valid_wav(self):
        data = sk.decode_response(stream(PCM[:13], PCM[13:]))
        sk.validate_wav(data)
        with wave.open(io.BytesIO(data)) as recording:
            self.assertEqual(recording.readframes(recording.getnframes()), PCM)
        direct = json.dumps({"audioChunk": {"data": base64.b64encode(PCM).decode()}}).encode()
        self.assertEqual(sk.decode_response(direct), data)

    def test_bad_or_partial_streams_are_not_saved(self):
        cases = [b"", b"not json", b'{}', b'{"error":{"message":"dummy"}}',
                 stream(b"a"), stream(PCM) + b'{"error":{}}',
                 b'{"result":{"audioChunk":{"data":"%%invalid"}}}',
                 stream(b"\x00" * (sk.MAX_PCM + 2))]
        for raw in cases:
            with self.subTest(length=len(raw)), self.assertRaises(sk.UserError):
                sk.decode_response(raw)

    def test_http_request_and_no_secret_in_receipts(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = stream(PCM)
        opener = Mock()
        opener.open.return_value = response
        self.network.side_effect = None
        self.network.return_value = opener
        payload = sk.make_payload("Привет!")
        def inspect_request(request, timeout):
            self.assertEqual(request.full_url, sk.ENDPOINT)
            self.assertEqual(request.get_method(), "POST")
            self.assertEqual(request.get_header("Authorization"), "Api-Key " + SECRET)
            self.assertEqual(request.get_header("X-data-logging-enabled"), "false")
            self.assertEqual(json.loads(request.data), payload)
            self.assertEqual(timeout, 60)
            return response
        opener.open.side_effect = inspect_request
        data = sk.synthesize(payload, SECRET)
        opener.open.assert_called_once()
        self.assertIsNone(opener.open.call_args.args[0].get_header("Authorization"))
        self.cache.mkdir()
        sk.save_recording(self.cache, sk.request_hash(payload), payload, data)
        for file in self.cache.iterdir():
            self.assertNotIn(SECRET.encode(), file.read_bytes())

    def test_errors_are_redacted_and_never_retried(self):
        self.network.side_effect = None
        for error in [urllib.error.HTTPError(sk.ENDPOINT, code, SECRET, {}, io.BytesIO(SECRET.encode()))
                      for code in (400, 401, 403, 429, 500)] + [urllib.error.URLError(SECRET), TimeoutError(SECRET)]:
            opener = Mock()
            opener.open.side_effect = error
            self.network.return_value = opener
            with self.subTest(error=type(error)), self.assertRaises(sk.UserError) as result:
                sk.synthesize(sk.make_payload("Привет"), SECRET)
            self.assertNotIn(SECRET, str(result.exception))
            opener.open.assert_called_once()
        with self.assertRaises(sk.UserError):
            sk.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.com")

    def test_cache_reuse_and_invalidation(self):
        key = self.seed_cache()
        with patch.object(sk, "read_key") as read:
            self.assertEqual(self.run_cli("--synthesize")[0], 0)
            read.assert_not_called()
        exported = json.loads((self.cache / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(exported["clips"][0]["file"], key + ".wav")
        changed = sk.make_payload(self.clips[0]["text"] + "!")
        self.assertNotEqual(key, sk.request_hash(changed))
        changed["hints"][1]["role"] = "good"
        self.assertNotEqual(key, sk.request_hash(changed))
        (self.cache / (key + ".wav")).write_bytes(b"corrupt")
        self.assertEqual(self.run_cli("--synthesize")[0], 1)
        self.network.assert_not_called()

    def test_duplicate_text_costs_one_request(self):
        entries, pending = sk.plan_clips(self.clips + [{**self.clips[0], "id": "duplicate"}], self.cache)
        self.assertEqual(len(entries), 2)
        self.assertEqual(len(pending), 1)

    def test_success_then_retry_uses_only_cached_audio(self):
        with patch.object(sk.sys.stdin, "isatty", return_value=True), \
                patch.object(sk.sys, "stderr", Mock(isatty=lambda: True)), \
                patch("builtins.input", return_value="СИНТЕЗ"), \
                patch.object(sk, "read_key", return_value=SECRET) as read, \
                patch.object(sk, "synthesize", return_value=sk.decode_response(stream(PCM))) as synth, \
                redirect_stdout(io.StringIO()):
            sk.generate(self.clips, self.cache, sk.PRICE)
            sk.generate(self.clips, self.cache, sk.PRICE)
            read.assert_called_once()
            synth.assert_called_once()
        for file in self.cache.iterdir():
            self.assertNotIn(SECRET.encode(), file.read_bytes())

    def test_lock_and_invalid_budget_and_cli_secret(self):
        with sk.cache_lock(self.cache):
            self.assertEqual(self.run_cli("--synthesize")[0], 1)
        self.assertFalse((self.cache / ".synthesis.lock").exists())
        for budget in ["NaN", "Infinity", "-1", "no"]:
            self.assertEqual(self.run_cli("--max-cost-rub", budget)[0], 1)
        self.assertEqual(self.run_cli("--api-key", SECRET)[0], 1)

    def test_batch_stops_on_first_failure_and_preserves_success(self):
        clips = self.clips + [{"id": "second", "text": "Вторая реплика"},
                              {"id": "third", "text": "Третья реплика"}]
        with patch.object(sk.sys.stdin, "isatty", return_value=True), \
                patch.object(sk.sys, "stderr", Mock(isatty=lambda: True)), \
                patch("builtins.input", return_value="СИНТЕЗ"), \
                patch.object(sk, "read_key", return_value=SECRET), \
                patch.object(sk, "synthesize", side_effect=[sk.decode_response(stream(PCM)), sk.UserError("Ошибка")]) as synth, \
                redirect_stdout(io.StringIO()):
            with self.assertRaises(sk.UserError):
                sk.generate(clips, self.cache, sk.PRICE * 3)
            self.assertEqual(synth.call_count, 2)
        self.assertTrue(sk.cached(self.cache, sk.request_hash(sk.make_payload(clips[0]["text"]))))
        self.assertFalse((self.cache / "manifest.json").exists())
        self.assertFalse((self.cache / ".synthesis.lock").exists())

    @unittest.skipUnless(os.name == "nt", "Windows launcher")
    def test_windows_launcher_preserves_failure_exit_code(self):
        result = subprocess.run(
            ["cmd", "/d", "/c", str(sk.ROOT / "scripts/speechkit.cmd"), "--max-cost-rub", "invalid"],
            capture_output=True, timeout=10,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn(b"--max-cost-rub", result.stderr)


if __name__ == "__main__":
    unittest.main()
