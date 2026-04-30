from __future__ import annotations

import logging
import os
import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.models.segment import SegmentMetadata
from app.providers.base import SynthesisProvider, SynthesisResult
from app.emotion_noise_scale import get_noise_scale

logger = logging.getLogger(__name__)

DEFAULT_AUDIO_ROUTE = "/audio"
DEFAULT_AUDIO_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "generated-audio"

_DEFAULT_NOISE_SCALE: float = 0.333
_DEFAULT_LENGTH_SCALE: float = 1.0
_DEFAULT_NOISE_W: float = 0.8


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

        clips: list[Path] = []
        for segment in segments:
            if not segment.text.strip():
                continue

            # Extract emotion string from enum or plain string
            emotion = getattr(segment, "emotion", "neutral")
            emotion_str = emotion.value if hasattr(emotion, "value") else str(emotion)

            noise_scale = get_noise_scale(emotion_str)

            logger.info(
                "Synthesising segment | emotion=%s noise_scale=%.4f text=%r",
                emotion_str,
                noise_scale,
                segment.text[:60],
            )

            clips.append(
                self._synthesize_text(
                    text=segment.text.strip(),
                    noise_scale=noise_scale,
                    length_scale=getattr(segment, "length_scale", _DEFAULT_LENGTH_SCALE),
                    noise_w=getattr(segment, "noise_w", _DEFAULT_NOISE_W),
                )
            )

        if not clips:
            raise RuntimeError("No text available for Piper synthesis")

        audio_path = clips[0] if len(clips) == 1 else self._concat_wavs(clips)

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

    def _synthesize_text(
        self,
        text: str,
        noise_scale: float = _DEFAULT_NOISE_SCALE,
        length_scale: float = _DEFAULT_LENGTH_SCALE,
        noise_w: float = _DEFAULT_NOISE_W,
    ) -> Path:
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
                "--model", str(self.model_path),
                "--output_file", str(output_path),
                "--noise-scale", str(noise_scale),
                "--length-scale", str(length_scale),
                "--noise-w", str(noise_w),
            ],
            input=text,
            text=True,
            capture_output=True,
            check=True,
        )

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("Piper did not produce an output WAV file")

        return output_path

    def _concat_wavs(self, clips: list[Path]) -> Path:
        output_path = self.output_dir / f"{uuid4().hex}.wav"
        all_frames = b""
        params = None
        for clip in clips:
            with wave.open(str(clip), "rb") as wf:
                if params is None:
                    params = wf.getparams()
                all_frames += wf.readframes(wf.getnframes())
        with wave.open(str(output_path), "wb") as out:
            out.setparams(params)
            out.writeframes(all_frames)
        for clip in clips:
            clip.unlink(missing_ok=True)
        return output_path