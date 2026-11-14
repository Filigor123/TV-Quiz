#!/usr/bin/env python3
"""Local YouTube discovery, media prep, and Russian transcription helpers."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


def media_home() -> Path:
    return Path(os.environ.get("TVQUIZ_MEDIA_HOME", ".local-tools/media-13")).expanduser().resolve()


def ffmpeg_path() -> str:
    configured = os.environ.get("FFMPEG_BINARY")
    if configured:
        return configured
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        found = shutil.which("ffmpeg")
        if found:
            return found
        raise SystemExit("FFmpeg is missing. Install imageio-ffmpeg or set FFMPEG_BINARY.")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def search(args: argparse.Namespace) -> None:
    query = f"ytsearch{args.limit}:{args.query}"
    run([
        sys.executable,
        "-m",
        "yt_dlp",
        "--flat-playlist",
        "--no-warnings",
        "--print",
        "%(id)s\t%(title)s\t%(duration)s\t%(webpage_url)s",
        query,
    ])


def validate_url(value: str) -> str:
    if not value.startswith(("https://", "http://")):
        raise SystemExit("Use a direct public HTTP(S) source URL.")
    return value


def fetch(args: argparse.Namespace) -> None:
    url = validate_url(args.url)
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    template = str(output.with_suffix("")) + ".%(ext)s"
    command = [sys.executable, "-m", "yt_dlp", "--no-playlist", "--no-progress", "-o", template]
    direct_file = bool(Path(urlparse(url).path).suffix)
    if args.audio:
        command += ["-f", "bestaudio/best"]
    else:
        command += ["-f", "best" if direct_file else "bv*[height<=720]+ba/b[height<=720]", "--merge-output-format", "mp4"]
    command.append(url)
    run(command)
    downloaded = [p for p in output.parent.glob(output.stem + ".*") if p.suffix not in {".part", ".json"}]
    if not downloaded:
        raise SystemExit(f"Download completed without an output file under {output.parent}")
    if args.audio:
        source = downloaded[0]
        target = output.with_suffix(".mp3")
        if source.suffix.lower() != ".mp3":
            run([ffmpeg_path(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-vn", "-c:a", "libmp3lame", "-b:a", "160k", str(target)])
        else:
            target = source
        print(f"Audio: {target}")
    else:
        print(f"Media: {downloaded[0]}")


def transcribe(args: argparse.Namespace) -> None:
    from faster_whisper import WhisperModel

    source = Path(args.input).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Input does not exist: {source}")
    target = Path(args.output).expanduser().resolve() if args.output else source.with_suffix(".srt")
    target.parent.mkdir(parents=True, exist_ok=True)
    model_dir = media_home() / "cache" / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8", download_root=str(model_dir))
    segments, info = model.transcribe(
        str(source),
        language=None if args.language == "auto" else args.language,
        vad_filter=True,
        beam_size=5,
    )

    def stamp(seconds: float) -> str:
        milliseconds = round(seconds * 1000)
        hours, milliseconds = divmod(milliseconds, 3_600_000)
        minutes, milliseconds = divmod(milliseconds, 60_000)
        seconds_part, milliseconds = divmod(milliseconds, 1000)
        return f"{hours:02}:{minutes:02}:{seconds_part:02},{milliseconds:03}"

    count = 0
    with target.open("w", encoding="utf-8", newline="\n") as stream:
        for count, segment in enumerate(segments, start=1):
            text = re.sub(r"\s+", " ", segment.text).strip()
            stream.write(f"{count}\n{stamp(segment.start)} --> {stamp(segment.end)}\n{text}\n\n")
    print(f"Language: {info.language} ({info.language_probability:.2f}); segments: {count}")
    print(f"Transcript: {target}")


def cut(args: argparse.Namespace) -> None:
    source = Path(args.input).expanduser().resolve()
    target = Path(args.output).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Input does not exist: {source}")
    if args.start < 0 or not 1 <= args.duration <= 60:
        raise SystemExit("Start must be non-negative and clip duration must be 1 to 60 seconds.")
    target.parent.mkdir(parents=True, exist_ok=True)
    command = [ffmpeg_path(), "-hide_banner", "-loglevel", "error", "-y"]
    if args.audio:
        command += ["-i", str(source), "-ss", str(args.start), "-t", str(args.duration), "-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "160k", str(target)]
    else:
        command += ["-i", str(source), "-ss", str(args.start), "-t", str(args.duration), "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", str(target)]
    run(command)
    print(f"Clip: {target}")


def extract_frame(args: argparse.Namespace) -> None:
    source = Path(args.input).expanduser().resolve()
    target = Path(args.output).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Input does not exist: {source}")
    if args.at < 0:
        raise SystemExit("Frame time must be non-negative.")
    target.parent.mkdir(parents=True, exist_ok=True)
    run([ffmpeg_path(), "-hide_banner", "-loglevel", "error", "-y", "-ss", str(args.at), "-i", str(source), "-frames:v", "1", str(target)])
    print(f"Frame: {target}")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(required=True)

    cmd = commands.add_parser("search", help="Search public YouTube results; does not identify a clip automatically.")
    cmd.add_argument("query")
    cmd.add_argument("--limit", type=int, default=5, choices=range(1, 11))
    cmd.set_defaults(func=search)

    cmd = commands.add_parser("fetch", help="Download media accessible at a public URL.")
    cmd.add_argument("url")
    cmd.add_argument("--output", required=True, help="Output path stem; filenames do not use source titles.")
    cmd.add_argument("--audio", action="store_true", help="Extract audio as MP3 instead of downloading video.")
    cmd.set_defaults(func=fetch)

    cmd = commands.add_parser("transcribe", help="Create a timestamped SRT transcript with Whisper.")
    cmd.add_argument("input")
    cmd.add_argument("--output")
    cmd.add_argument("--language", default="ru", help="Language code; default: ru. Use 'auto' for detection.")
    cmd.add_argument("--model", default="small", choices=("small",))
    cmd.set_defaults(func=transcribe)

    cmd = commands.add_parser("clip", help="Cut a 1 to 60 second audio or video excerpt.")
    cmd.add_argument("input")
    cmd.add_argument("--start", type=float, required=True)
    cmd.add_argument("--duration", type=float, required=True)
    cmd.add_argument("--output", required=True)
    cmd.add_argument("--audio", action="store_true")
    cmd.set_defaults(func=cut)

    cmd = commands.add_parser("frame", help="Extract one frame at a timestamp.")
    cmd.add_argument("input")
    cmd.add_argument("--at", type=float, required=True)
    cmd.add_argument("--output", required=True)
    cmd.set_defaults(func=extract_frame)
    return root


if __name__ == "__main__":
    arguments = parser().parse_args()
    arguments.func(arguments)
