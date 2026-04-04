from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.models.segment import SegmentMetadata
from app.providers.base import SynthesisProvider, SynthesisResult

DEFAULT_AUDIO_ROUTE = "/audio"
DEFAULT_AUDIO_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "generated-audio"
POSITIVE_EMOTICONS = (":)", ":D", "=)", "^^")
POSITIVE_UNICODE_EMOJIS = (
    "\U0001F60A",
    "\U0001F604",
    "\U0001F603",
    "\U0001F642",
    "\U0001F601",
    "\U0001F606",
    "\U0001F609",
    "\U0001F60D",
    "\U0001F970",
)
NON_SPOKEN_MARKERS = tuple(sorted((*POSITIVE_EMOTICONS, *POSITIVE_UNICODE_EMOJIS), key=len, reverse=True))
COLLAPSE_WHITESPACE_RE = re.compile(r"\s+")
SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,!?;.])")


@dataclass(frozen=True)
class PreparedSegmentSynthesis:
    index: int
    original_text: str
    spoken_text: str
    pause_ms: int
    rate: float
    pitch_hint: float
    length_scale: float


@dataclass(frozen=True)
class PreparedSynthesisPlan:
    segments: tuple[PreparedSegmentSynthesis, ...]
    total_pause_ms: int


def resolve_audio_output_dir(output_dir: str | Path | None = None) -> Path:
    configured_dir = output_dir or os.environ.get("TTS_OUTPUT_DIR")
    if configured_dir is None:
        return DEFAULT_AUDIO_OUTPUT_DIR
    return Path(configured_dir)


class PiperSynthesisProvider(SynthesisProvider):
    def __init__(
        self,
        *,
        piper_bin: str | None = None,
        ffmpeg_bin: str | None = None,
        model_path: str | Path | None = None,
        output_dir: str | Path | None = None,
        audio_route: str = DEFAULT_AUDIO_ROUTE,
    ) -> None:
        self.piper_bin = piper_bin or os.environ.get("PIPER_BIN", "piper")
        self.ffmpeg_bin = ffmpeg_bin or os.environ.get("FFMPEG_BIN", "ffmpeg")
        self.model_path = Path(model_path) if model_path is not None else (
            Path(os.environ["PIPER_MODEL_PATH"]) if os.environ.get("PIPER_MODEL_PATH") else None
        )
        self.output_dir = resolve_audio_output_dir(output_dir)
        self.audio_route = audio_route.rstrip("/") or DEFAULT_AUDIO_ROUTE

    def get_readiness(self) -> dict[str, object]:
        binary_available = self._binary_available(self.piper_bin)
        ffmpeg_available = self._binary_available(self.ffmpeg_bin)
        model_configured = self.model_path is not None
        model_exists = bool(self.model_path and self.model_path.exists())

        return {
            "piper_bin": self.piper_bin,
            "ffmpeg_bin": self.ffmpeg_bin,
            "model_path": str(self.model_path) if self.model_path is not None else None,
            "binary_available": binary_available,
            "ffmpeg_available": ffmpeg_available,
            "model_configured": model_configured,
            "model_exists": model_exists,
            "ready": binary_available and ffmpeg_available and model_exists,
        }

    def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
        plan = self._prepare_synthesis_plan(segments)
        audio_path = self._synthesize_segments(plan)

        return SynthesisResult(
            audio_url=f"{self.audio_route}/{audio_path.name}",
            received_segments=len(segments),
            total_pause_ms=plan.total_pause_ms,
        )

    def _binary_available(self, binary: str) -> bool:
        binary_path = Path(binary)
        if binary_path.is_file():
            return True
        return shutil.which(binary) is not None

    def _prepare_synthesis_plan(self, segments: list[SegmentMetadata]) -> PreparedSynthesisPlan:
        prepared_segments: list[PreparedSegmentSynthesis] = []

        for index, segment in enumerate(segments):
            spoken_text = self._sanitize_spoken_text(segment.text)
            if not spoken_text:
                continue

            prepared_segments.append(
                PreparedSegmentSynthesis(
                    index=index,
                    original_text=segment.text,
                    spoken_text=spoken_text,
                    pause_ms=segment.pause_ms,
                    rate=segment.rate,
                    pitch_hint=segment.pitch_hint,
                    length_scale=self._to_length_scale(segment.rate),
                )
            )

        if not prepared_segments:
            raise RuntimeError("No spoken text available for Piper synthesis")

        return PreparedSynthesisPlan(
            segments=tuple(prepared_segments),
            total_pause_ms=sum(segment.pause_ms for segment in prepared_segments),
        )

    def _synthesize_segments(self, plan: PreparedSynthesisPlan) -> Path:
        self._assert_ready()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.output_dir / f"{uuid4().hex}.wav"

        with tempfile.TemporaryDirectory(dir=self.output_dir) as temp_dir_name:
            temp_dir = Path(temp_dir_name)
            concat_inputs: list[Path] = []

            for prepared in plan.segments:
                raw_segment_path = temp_dir / f"segment-{prepared.index}.wav"
                processed_segment_path = temp_dir / f"segment-{prepared.index}-processed.wav"

                self._run_piper(prepared, raw_segment_path)
                self._apply_pitch_hint(raw_segment_path, processed_segment_path, prepared.pitch_hint)
                concat_inputs.append(processed_segment_path)

                if prepared.pause_ms > 0:
                    pause_path = temp_dir / f"pause-{prepared.index}.wav"
                    sample_rate, channels, sample_width = self._read_wav_format(processed_segment_path)
                    self._create_silence_wav(
                        pause_path,
                        duration_ms=prepared.pause_ms,
                        sample_rate=sample_rate,
                        channels=channels,
                        sample_width=sample_width,
                    )
                    concat_inputs.append(pause_path)

            self._concat_audio_files(concat_inputs, output_path, temp_dir)

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("Combined synthesis output WAV file is missing or empty")

        return output_path

    def _assert_ready(self) -> None:
        readiness = self.get_readiness()
        if not readiness["binary_available"]:
            raise RuntimeError(f"Piper binary is not available: {self.piper_bin}")
        if not readiness["ffmpeg_available"]:
            raise RuntimeError(f"FFmpeg binary is not available: {self.ffmpeg_bin}")
        if not readiness["model_configured"]:
            raise RuntimeError("PIPER_MODEL_PATH is not configured")
        if not readiness["model_exists"]:
            raise RuntimeError(f"Piper model file does not exist: {self.model_path}")

    def _sanitize_spoken_text(self, text: str) -> str:
        cleaned = text
        for marker in NON_SPOKEN_MARKERS:
            cleaned = cleaned.replace(marker, " ")
        cleaned = COLLAPSE_WHITESPACE_RE.sub(" ", cleaned)
        cleaned = SPACE_BEFORE_PUNCT_RE.sub(r"\1", cleaned)
        return cleaned.strip()

    def _to_length_scale(self, rate: float) -> float:
        return max(0.5, min(2.0, 1.0 / rate))

    def _run_piper(self, prepared: PreparedSegmentSynthesis, output_path: Path) -> None:
        subprocess.run(
            [
                self.piper_bin,
                "--model",
                str(self.model_path),
                "--output_file",
                str(output_path),
                "--length-scale",
                f"{prepared.length_scale:.3f}",
                "--sentence-silence",
                "0",
            ],
            input=prepared.spoken_text,
            text=True,
            capture_output=True,
            check=True,
        )

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("Piper did not produce a per-segment WAV file")

    def _apply_pitch_hint(self, input_path: Path, output_path: Path, pitch_hint: float) -> None:
        sample_rate, _, _ = self._read_wav_format(input_path)
        pitch_factor = math.pow(2.0, pitch_hint / 12.0)
        tempo_compensation = 1.0 / pitch_factor
        audio_filter = (
            f"asetrate={sample_rate}*{pitch_factor:.6f},"
            f"aresample={sample_rate},"
            f"atempo={tempo_compensation:.6f}"
        )

        subprocess.run(
            [
                self.ffmpeg_bin,
                "-y",
                "-i",
                str(input_path),
                "-filter:a",
                audio_filter,
                "-c:a",
                "pcm_s16le",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("FFmpeg did not produce a processed per-segment WAV file")

    def _read_wav_format(self, audio_path: Path) -> tuple[int, int, int]:
        with wave.open(str(audio_path), "rb") as wav_file:
            return wav_file.getframerate(), wav_file.getnchannels(), wav_file.getsampwidth()

    def _create_silence_wav(
        self,
        output_path: Path,
        *,
        duration_ms: int,
        sample_rate: int,
        channels: int,
        sample_width: int,
    ) -> None:
        frame_count = int(sample_rate * (duration_ms / 1000))
        silent_frame = b"\x00" * sample_width * channels

        with wave.open(str(output_path), "wb") as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(silent_frame * frame_count)

    def _concat_audio_files(self, input_paths: list[Path], output_path: Path, temp_dir: Path) -> None:
        concat_file = temp_dir / "concat.txt"
        concat_file.write_text(
            "\n".join(f"file '{path.as_posix()}'" for path in input_paths),
            encoding="utf-8",
        )

        subprocess.run(
            [
                self.ffmpeg_bin,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-c:a",
                "pcm_s16le",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
