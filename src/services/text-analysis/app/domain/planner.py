from __future__ import annotations

from app.domain.mapper import map_emotion
from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import SegmentMetadata


def plan_segment(text: str, signals: ExtractedSignals) -> SegmentMetadata:
    mapped = map_emotion(signals)

    rate = 1.0
    pitch_hint = 0.0
    pause_ms = 150

    if signals.has_exclamation:
        rate = 1.1
        pitch_hint = 2.0

    if signals.has_question:
        pitch_hint = max(pitch_hint, 1.0)

    if signals.has_positive_emoji:
        pitch_hint = max(pitch_hint, 1.5)

    if signals.has_ellipsis:
        pause_ms = 300
        rate = min(rate, 0.9)

    return SegmentMetadata(
        text=text,
        emotion=mapped.emotion,
        intensity=mapped.intensity,
        pause_ms=pause_ms,
        rate=rate,
        pitch_hint=pitch_hint,
        cues=list(signals.cues),
    )
