#!/usr/bin/env python3
"""Offline estimate first; optional, explicitly confirmed SpeechKit v3 synthesis."""

import argparse
import base64
from contextlib import contextmanager
from decimal import Decimal, InvalidOperation
import getpass
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request
import warnings
import wave


ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = "https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis"
PRICE = Decimal("0.1626")
PRICE_DATE = "2026-11-17"
PRICE_URL = "https://aistudio.yandex.ru/ru/docs/speechkit/pricing"
SAMPLE_RATE = 22050
MAX_RESPONSE = 4 * 1024 * 1024
MAX_PCM = SAMPLE_RATE * 2 * 24


class UserError(Exception):
    """Only fixed, non-secret messages may be shown to the user."""


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def make_payload(text):
    # Stay strictly below 250: avoid the ambiguous boundary in the price examples.
    if not isinstance(text, str) or not text.strip() or len(text) >= 250:
        raise UserError("Каждая реплика должна содержать от 1 до 249 символов, включая пробелы.")
    return {
        "text": text,
        "hints": [{"voice": "alexander"}, {"role": "neutral"}, {"speed": 1.0}],
        "outputAudioSpec": {"rawAudio": {
            "audioEncoding": "LINEAR16_PCM", "sampleRateHertz": str(SAMPLE_RATE)
        }},
        "loudnessNormalizationType": "LUFS",
        "unsafeMode": False,
    }


def load_clips(path):
    try:
        document = json.loads(path.read_text(encoding="utf-8-sig"))
        clips = document["clips"]
        if not isinstance(clips, list) or not clips:
            raise ValueError
        seen = set()
        for clip in clips:
            if not isinstance(clip, dict) or set(clip) != {"id", "text"}:
                raise ValueError
            if not isinstance(clip["id"], str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", clip["id"]):
                raise ValueError
            if clip["id"] in seen:
                raise ValueError
            seen.add(clip["id"])
            make_payload(clip["text"])
        return clips
    except (OSError, ValueError, KeyError, TypeError):
        raise UserError("Не удалось прочитать список clips: нужны уникальные id и text в UTF-8 JSON.") from None


def request_hash(payload):
    return digest(canonical({"endpoint": ENDPOINT, "payload": payload, "cacheVersion": 1}))


def validate_wav(data):
    try:
        with wave.open(io.BytesIO(data), "rb") as audio:
            if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, SAMPLE_RATE, "NONE"):
                raise ValueError
            frames = audio.getnframes()
            if not 0 < frames <= SAMPLE_RATE * 24 or len(audio.readframes(frames)) != frames * 2:
                raise ValueError
    except (wave.Error, EOFError, ValueError):
        raise UserError("Запись WAV повреждена или имеет неожиданный формат.") from None


def cached(cache, key):
    audio_path, receipt_path = cache / (key + ".wav"), cache / (key + ".json")
    if not audio_path.exists() and not receipt_path.exists():
        return False
    try:
        data = audio_path.read_bytes()
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if receipt["requestHash"] != key or receipt["audioSha256"] != digest(data):
            raise ValueError
        validate_wav(data)
        return True
    except (OSError, ValueError, KeyError, TypeError, UserError):
        raise UserError("Неполный или повреждённый кеш. Проверьте WAV/JSON; автоматической повторной оплаты не будет.") from None


def plan_clips(clips, cache):
    entries, pending = [], {}
    for clip in clips:
        payload = make_payload(clip["text"])
        key = request_hash(payload)
        exists = cached(cache, key)
        entries.append({**clip, "requestHash": key, "file": key + ".wav", "cached": exists})
        if not exists:
            pending[key] = payload
    return entries, pending


def show_estimate(entries, pending):
    characters = sum(len(payload["text"]) for payload in pending.values())
    cost = PRICE * len(pending)
    print("Александр / neutral / обычная скорость. Модель general, API v3.")
    for entry in entries:
        print(f"  {entry['id']}: {len(entry['text'])} символов — " + ("готовая запись" if entry["cached"] else "нужен синтез"))
    print(f"Новых запросов: {len(pending)}; символов: {characters}; оценка: {cost:.4f} ₽ с НДС.")
    print(f"Справочный рублёвый тариф на {PRICE_DATE}: {PRICE} ₽/запрос. {PRICE_URL}")
    print("Перед оплатой сверьте тариф и валюту своего аккаунта. Оценка не проверяет баланс/скидки.")
    return cost


def read_key():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise UserError("Для скрытого ввода откройте обычный локальный терминал Windows.")
    try:
        # Fail closed instead of getpass's fallback to echoed input.
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            key = getpass.getpass("API-ключ (ввод скрыт, не сохраняется): ")
    except (getpass.GetPassWarning, EOFError):
        raise UserError("Скрытый ввод недоступен. Ключ не прочитан; запустите в обычном терминале.") from None
    if not key or len(key) > 4096 or any(ord(c) < 33 or ord(c) > 126 for c in key):
        raise UserError("Пустой ключ или недопустимые символы. Введите секретную часть API-ключа без пробелов.")
    return key


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward Authorization to another URL, even after an HTTPS redirect.
        raise UserError("Сервис вернул перенаправление. Запрос остановлен без повтора.")


def decode_response(raw):
    try:
        text = raw.decode("utf-8")
        decoder = json.JSONDecoder()
        offset, chunks = 0, []
        while offset < len(text):
            if text[offset].isspace():
                offset += 1
                continue
            item, offset = decoder.raw_decode(text, offset)
            if not isinstance(item, dict) or "error" in item:
                raise ValueError
            result = item.get("result", item)
            if not isinstance(result, dict) or "error" in result:
                raise ValueError
            chunk = result.get("audioChunk", {}).get("data")
            if chunk is not None:
                chunks.append(base64.b64decode(chunk, validate=True))
        pcm = b"".join(chunks)
        if not pcm or len(pcm) % 2 or len(pcm) > MAX_PCM:
            raise ValueError
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setparams((1, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
            audio.writeframes(pcm)
        return output.getvalue()
    except (ValueError, TypeError, AttributeError):
        raise UserError("Некорректный или пустой ответ синтеза. Повтора нет; проверьте потребление в Яндексе.") from None


def synthesize(payload, key):
    request = urllib.request.Request(ENDPOINT, data=canonical(payload), method="POST", headers={
        "Authorization": "Api-Key " + key,
        "Content-Type": "application/json",
        "x-data-logging-enabled": "false",
    })
    try:
        opener = urllib.request.build_opener(NoRedirect())
        with opener.open(request, timeout=60) as response:
            raw = response.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            raise UserError("Ответ слишком велик. Синтез остановлен без повтора.")
        return decode_response(raw)
    except urllib.error.HTTPError as error:
        messages = {
            400: "Проверьте текст и параметры; возможен лимит 24 секунд.",
            401: "Проверьте секретную часть и срок действия API-ключа.",
            403: "Проверьте роль ai.speechkit-tts.user, область yc.ai.speechkitTts.execute и платёжный аккаунт.",
            429: "Достигнут лимит запросов; автоматического повтора нет.",
        }
        message = messages.get(error.code, "Сервис отклонил запрос; автоматического повтора нет.")
        code = error.code
        error.close()
        raise UserError(f"HTTP {code}. {message}") from None
    except (OSError, urllib.error.URLError):
        raise UserError("Сеть или таймаут. Результат оплаты неизвестен: проверьте потребление до нового запуска.") from None
    finally:
        request.remove_header("Authorization")


def atomic_write(path, data):
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_bytes(data)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def save_recording(cache, key, payload, data):
    validate_wav(data)
    atomic_write(cache / (key + ".wav"), data)
    atomic_write(cache / (key + ".json"), canonical({
        "requestHash": key, "audioSha256": digest(data), "request": payload,
        "provider": "Yandex SpeechKit API v3", "model": "general",
    }))


@contextmanager
def cache_lock(cache):
    cache.mkdir(parents=True, exist_ok=True)
    lock = cache / ".synthesis.lock"
    try:
        handle = lock.open("x")
    except FileExistsError:
        raise UserError("Кеш занят. Закройте другой генератор; после аварии удалите .synthesis.lock вручную.") from None
    try:
        handle.close()
        yield
    finally:
        lock.unlink(missing_ok=True)


def generate(clips, cache, budget):
    with cache_lock(cache):
        entries, pending = plan_clips(clips, cache)
        cost = show_estimate(entries, pending)
        if cost > budget:
            raise UserError("Оценка превышает --max-cost-rub. Синтез и ввод ключа не начаты.")
        if pending:
            if not sys.stdin.isatty() or not sys.stderr.isatty():
                raise UserError("Оплата требует подтверждения в обычном локальном терминале.")
            print("Будет выполнен платный синтез перечисленных новых записей, без автоматических повторов.")
            if input("Для разрешения расходов введите СИНТЕЗ (Enter — отмена): ").strip() != "СИНТЕЗ":
                print("Отменено. Запросов нет, ключ не запрашивался.")
                return
            key = read_key()
            try:
                for request_id, payload in pending.items():
                    save_recording(cache, request_id, payload, synthesize(payload, key))
            finally:
                # No persistence; Python strings cannot be reliably zeroed in memory.
                key = None
        atomic_write(cache / "manifest.json", canonical({
            "version": 1,
            "clips": [{k: v for k, v in entry.items() if k != "cached"} for entry in entries],
        }))
        print(f"Готовые WAV и manifest.json: {cache}")
        print("Повторный запуск использует эти записи. В игру они ещё не подключены.")


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # An accidentally supplied --api-key must not be echoed back by argparse.
        raise UserError("Неверные параметры. Используйте --help. Ключ нельзя передавать в командной строке.")


def main(argv=None):
    parser = SafeParser(description="Оценка SpeechKit без сети по умолчанию. Ключ — только через скрытый ввод.")
    parser.add_argument("--manifest", type=Path, default=ROOT / "content/speechkit/sample.json")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / ".local-tools/speechkit")
    parser.add_argument("--synthesize", action="store_true", help="запросить разрешение на платный синтез")
    parser.add_argument("--max-cost-rub", default=str(PRICE), help="предел оценки расходов, по умолчанию одна проба")
    try:
        args = parser.parse_args(argv)
        try:
            budget = Decimal(args.max_cost_rub)
            if not budget.is_finite() or budget < 0:
                raise ValueError
        except (InvalidOperation, ValueError):
            raise UserError("--max-cost-rub должен быть конечным неотрицательным числом.") from None
        clips = load_clips(args.manifest)
        if args.synthesize:
            generate(clips, args.cache_dir, budget)
        else:
            show_estimate(*plan_clips(clips, args.cache_dir))
            print("Только оценка: сеть не использовалась, ключ не нужен, файлы не создавались.")
        return 0
    except UserError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (KeyboardInterrupt, EOFError):
        print("Прервано. Если запрос уже отправлен, проверьте потребление до повтора.", file=sys.stderr)
        return 1
    except Exception:
        # Do not expose response bodies, request objects, or secrets in tracebacks.
        print("Операция остановлена. Проверьте файлы и доступ к каталогу; повтора запроса нет.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
