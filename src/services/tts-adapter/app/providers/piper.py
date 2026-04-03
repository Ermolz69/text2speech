from __future__ import annotations

import os
import subprocess
from pathlib import Path
from uuid import uuid4

from app.models.segment import SegmentMetadata
from app.providers.base import SynthesisProvider, SynthesisResult

DEFAULT_AUDIO_ROUTE = "/audio"
DEFAULT_AUDIO_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "generated-audio"


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
        model_path: str | None = None,
        output_dir: str | Path | None = None,
        audio_route: str = DEFAULT_AUDIO_ROUTE,
    ) -> None:
        self.piper_bin = piper_bin or os.environ.get("PIPER_BIN", "piper")
        self.model_path = model_path or os.environ.get("PIPER_MODEL_PATH")
        self.output_dir = resolve_audio_output_dir(output_dir)
        self.audio_route = audio_route.rstrip("/") or DEFAULT_AUDIO_ROUTE

    def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
        total_pause_ms = sum(segment.pause_ms for segment in segments)
        audio_path = self._synthesize_text(self._build_input_text(segments))

        return SynthesisResult(
            audio_url=f"{self.audio_route}/{audio_path.name}",
            received_segments=len(segments),
            total_pause_ms=total_pause_ms,
        )

    def _build_input_text(self, segments: list[SegmentMetadata]) -> str:
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
        if not text:
            raise RuntimeError("No text available for Piper synthesis")
        return text

    def _synthesize_text(self, text: str) -> Path:
        if not self.model_path:
            raise RuntimeError("PIPER_MODEL_PATH is not configured")

        self.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.output_dir / f"{uuid4().hex}.wav"

        subprocess.run(
            [
                self.piper_bin,
                "--model",
                self.model_path,
                "--output_file",
                str(output_path),
            ],
            input=text,
            text=True,
            capture_output=True,
            check=True,
        )

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("Piper did not produce an output WAV file")

        return output_path
