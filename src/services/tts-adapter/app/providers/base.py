from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.models.segment import SegmentMetadata


@dataclass(frozen=True)
class SynthesisResult:
    audio_url: str
    received_segments: int
    total_pause_ms: int


@dataclass(frozen=True)
class VoiceInfo:
    id: str
    label: str


class SynthesisProvider(Protocol):
    def list_voices(self) -> list[VoiceInfo]:
        ...

    def synthesize(
        self,
        segments: list[SegmentMetadata],
        *,
        voice_id: str,
        length_scale: float | None = None,
        noise_scale: float | None = None,
    ) -> SynthesisResult:
        ...
