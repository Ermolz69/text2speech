from __future__ import annotations

from dataclasses import dataclass

from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import Emotion


@dataclass(frozen=True)
class EmotionMapping:
    emotion: Emotion
    intensity: float


def map_emotion(signals: ExtractedSignals) -> EmotionMapping:
    if signals.has_angry_emoji:
        return EmotionMapping(emotion=Emotion.ANGRY, intensity=0.9)
    if signals.has_negative_emoji:
        return EmotionMapping(emotion=Emotion.SAD, intensity=0.7)
    if signals.has_excited_emoji:
        return EmotionMapping(emotion=Emotion.EXCITED, intensity=0.8)
    if signals.has_positive_emoji:
        return EmotionMapping(emotion=Emotion.HAPPY, intensity=0.7)
    if signals.has_ellipsis:
        return EmotionMapping(emotion=Emotion.SAD, intensity=0.4)
    if signals.has_repeated_exclamation:
        return EmotionMapping(emotion=Emotion.EXCITED, intensity=0.7)
    return EmotionMapping(emotion=Emotion.NEUTRAL, intensity=0.0)