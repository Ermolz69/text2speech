from __future__ import annotations

from dataclasses import dataclass

from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import Emotion


@dataclass(frozen=True)
class EmotionMapping:
    emotion: Emotion
    intensity: float


def map_emotion(signals: ExtractedSignals) -> EmotionMapping:
    if signals.is_all_caps and signals.has_repeated_exclamation:
        return EmotionMapping(emotion=Emotion.ANGRY, intensity=1.0)

    if signals.has_surprise_emoji or (signals.has_mixed_punctuation and signals.has_exclamation):
        return EmotionMapping(emotion=Emotion.SURPRISED, intensity=0.7)

    if signals.has_celebration_emoji or (signals.has_positive_emoji and signals.has_repeated_exclamation):
        return EmotionMapping(emotion=Emotion.EXCITED, intensity=0.9)

    if signals.has_positive_emoji:
        return EmotionMapping(emotion=Emotion.HAPPY, intensity=0.7)

    if signals.has_negative_emoji:
        return EmotionMapping(emotion=Emotion.SAD, intensity=0.7)

    if signals.has_ellipsis:
        if signals.has_question:
            return EmotionMapping(emotion=Emotion.SURPRISED, intensity=0.5)
        return EmotionMapping(emotion=Emotion.SAD, intensity=0.2)

    if signals.has_repeated_exclamation:
        return EmotionMapping(emotion=Emotion.EXCITED, intensity=0.8)

    if signals.has_exclamation:
        return EmotionMapping(emotion=Emotion.HAPPY, intensity=0.5)

    return EmotionMapping(emotion=Emotion.NEUTRAL, intensity=0.0)
