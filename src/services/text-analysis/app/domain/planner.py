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
        rate = 1.18
        pitch_hint = 3.0

    if signals.has_repeated_exclamation:
        rate = max(rate, 1.26)
        pitch_hint = max(pitch_hint, 4.5)

    if signals.has_question:
        pitch_hint = max(pitch_hint, 1.5)

    if signals.has_mixed_punctuation:
        rate = max(rate, 1.22)
        pitch_hint = max(pitch_hint, 3.5)

    if signals.has_positive_emoji:
        pitch_hint = max(pitch_hint, 2.0)

    if signals.has_ellipsis:
        pause_ms = 220
        if rate <= 1.0:
            rate = 0.96
        else:
            rate = max(1.05, rate - 0.08)

    return SegmentMetadata(
        text=text,
        emotion=mapped.emotion,
        intensity=mapped.intensity,
        pause_ms=pause_ms,
        rate=rate,
        pitch_hint=pitch_hint,
        cues=list(signals.cues),
    )
