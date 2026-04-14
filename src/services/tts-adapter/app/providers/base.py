from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.models.segment import SegmentMetadata


@dataclass(frozen=True)
class SynthesisResult:
    audio_url: str
    received_segments: int
    total_pause_ms: int


class SynthesisProvider(Protocol):
    def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
        ...
