from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any
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
        model_path: str | Path | None = None,
        output_dir: str | Path | None = None,
        audio_route: str = DEFAULT_AUDIO_ROUTE,
    ) -> None:
        self.piper_bin = piper_bin or os.environ.get("PIPER_BIN", "piper")
        self.model_path = Path(model_path) if model_path is not None else (
            Path(os.environ["PIPER_MODEL_PATH"]) if os.environ.get("PIPER_MODEL_PATH") else None
        )
        self.output_dir = resolve_audio_output_dir(output_dir)
        self.audio_route = audio_route.rstrip("/") or DEFAULT_AUDIO_ROUTE

    def get_readiness(self) -> dict[str, Any]:
        binary_available = self._binary_available()
        model_configured = self.model_path is not None
        model_exists = bool(self.model_path and self.model_path.exists())

        return {
            "piper_bin": self.piper_bin,
            "model_path": str(self.model_path) if self.model_path is not None else None,
            "binary_available": binary_available,
            "model_configured": model_configured,
            "model_exists": model_exists,
            "ready": binary_available and model_exists,
        }

    def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
        total_pause_ms = sum(segment.pause_ms for segment in segments)
        audio_path = self._synthesize_text(self._build_input_text(segments))

        return SynthesisResult(
            audio_url=f"{self.audio_route}/{audio_path.name}",
            received_segments=len(segments),
            total_pause_ms=total_pause_ms,
        )

    def _binary_available(self) -> bool:
        binary_path = Path(self.piper_bin)
        if binary_path.is_file():
            return True
        return shutil.which(self.piper_bin) is not None

    def _build_input_text(self, segments: list[SegmentMetadata]) -> str:
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
        if not text:
            raise RuntimeError("No text available for Piper synthesis")
        return text

    def _synthesize_text(self, text: str) -> Path:
        readiness = self.get_readiness()
        if not readiness["binary_available"]:
            raise RuntimeError(f"Piper binary is not available: {self.piper_bin}")
        if not readiness["model_configured"]:
            raise RuntimeError("PIPER_MODEL_PATH is not configured")
        if not readiness["model_exists"]:
            raise RuntimeError(f"Piper model file does not exist: {self.model_path}")

        self.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.output_dir / f"{uuid4().hex}.wav"

        subprocess.run(
            [
                self.piper_bin,
                "--model",
                str(self.model_path),
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
