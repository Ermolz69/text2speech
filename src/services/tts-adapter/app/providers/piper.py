from __future__ import annotations

from app.models.segment import SegmentMetadata
from app.providers.base import SynthesisProvider, SynthesisResult


class PiperSynthesisProvider(SynthesisProvider):
    def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
        total_pause_ms = sum(segment.pause_ms for segment in segments)
        return SynthesisResult(
            audio_url="/placeholder.wav",
            received_segments=len(segments),
            total_pause_ms=total_pause_ms,
        )
