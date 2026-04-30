from __future__ import annotations

from app.domain.mapper import map_emotion
from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import SegmentMetadata

_EMOTION_RATE: dict[str, float] = {
    "sad": 0.75,
    "sadness": 0.75,
    "calm": 0.85,
    "neutral": 1.0,
    "happy": 1.1,
    "joy": 1.1,
    "surprised": 1.15,
    "excited": 1.25,
    "angry": 1.3,
    "fear": 1.2,
    "disgust": 1.1,
}

_EMOTION_PAUSE: dict[str, int] = {
    "sad": 400,
    "sadness": 400,
    "calm": 300,
    "neutral": 150,
    "happy": 100,
    "joy": 100,
    "excited": 75,
    "angry": 75,
}

_EMOTION_PITCH: dict[str, float] = {
    "sad": -3.0,
    "sadness": -3.0,
    "calm": -1.0,
    "neutral": 0.0,
    "happy": 2.0,
    "joy": 2.5,
    "excited": 4.0,
    "angry": 3.0,
    "fear": 2.0,
}


def plan_segment(text: str, signals: ExtractedSignals) -> SegmentMetadata:
    mapped = map_emotion(signals)
    emotion_val = mapped.emotion.value

    rate = _EMOTION_RATE.get(emotion_val, 1.0)
    pitch_hint = _EMOTION_PITCH.get(emotion_val, 0.0)
    pause_ms = _EMOTION_PAUSE.get(emotion_val, 150)

    # Punctuation overrides (only if stronger than emotion default)
    if signals.has_exclamation:
        rate = max(rate, 1.1)
        pitch_hint = max(pitch_hint, 2.0)

    if signals.has_question:
        pitch_hint = max(pitch_hint, 1.0)

    if signals.has_ellipsis:
        pause_ms = max(pause_ms, 400)
        rate = min(rate, 0.85)

    return SegmentMetadata(
        text=text,
        emotion=mapped.emotion,
        intensity=mapped.intensity,
        pause_ms=pause_ms,
        rate=rate,
        pitch_hint=pitch_hint,
        cues=list(signals.cues),
    )