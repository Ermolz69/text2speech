from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.segment import Emotion as InternalEmotion
from app.models.segment import SegmentMetadata as InternalSegmentMetadata


class SharedEmotionLabel(str, Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    JOY = "joy"
    PLAYFUL = "playful"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    SURPRISE = "surprise"


class AnalyzeSegmentDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1)
    emotion: SharedEmotionLabel
    intensity: int = Field(..., ge=0, le=3)
    emoji: list[str] | None = None
    punctuation: list[str] | None = None
    pauseAfterMs: int | None = Field(default=None, ge=0)
    rate: float | None = Field(default=None, gt=0.0)
    pitchHint: float | None = None
    hesitationMarkers: list[str] | None = None
    stressedWords: list[str] | None = None


class SynthesisMetadataDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    segments: list[AnalyzeSegmentDto] | None = None
    emotion: SharedEmotionLabel | None = None
    intensity: int | None = Field(default=None, ge=0, le=3)
    format: Literal["wav", "mp3", "ogg"] | None = None


class SynthesizeRequestDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1)
    voiceId: str = Field(..., min_length=1)
    metadata: SynthesisMetadataDto | None = None

    @model_validator(mode="after")
    def validate_segments_present(self) -> "SynthesizeRequestDto":
        if not self.metadata or not self.metadata.segments:
            raise ValueError("metadata.segments are required")
        return self


class SynthesizeResponseDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audioUrl: str = Field(..., min_length=1)
    metadata: SynthesisMetadataDto | None = None
    metricsUrl: str | None = None


def _map_emotion(emotion: SharedEmotionLabel) -> InternalEmotion:
    match emotion:
        case SharedEmotionLabel.HAPPY | SharedEmotionLabel.JOY:
            return InternalEmotion.HAPPY
        case SharedEmotionLabel.PLAYFUL:
            return InternalEmotion.EXCITED
        case SharedEmotionLabel.SAD | SharedEmotionLabel.SADNESS:
            return InternalEmotion.SAD
        case SharedEmotionLabel.ANGER:
            return InternalEmotion.ANGRY
        case SharedEmotionLabel.SURPRISE:
            return InternalEmotion.SURPRISED
        case SharedEmotionLabel.FEAR:
            return InternalEmotion.NEUTRAL
        case SharedEmotionLabel.NEUTRAL:
            return InternalEmotion.NEUTRAL


def _map_intensity(intensity: int) -> float:
    return intensity / 3


def _to_cues(values: list[str] | None, prefix: str) -> list[str]:
    if not values:
        return []
    return [f"{prefix}{value}" for value in values]


def to_internal_segment(segment: AnalyzeSegmentDto) -> InternalSegmentMetadata:
    return InternalSegmentMetadata(
        text=segment.text,
        emotion=_map_emotion(segment.emotion),
        intensity=_map_intensity(segment.intensity),
        pause_ms=segment.pauseAfterMs or 0,
        rate=segment.rate or 1.0,
        pitch_hint=segment.pitchHint or 0.0,
        hesitation_markers=segment.hesitationMarkers or [],
        stressed_words=segment.stressedWords or [],
        cues=[
            *_to_cues(segment.emoji, "emoji:"),
            *_to_cues(segment.punctuation, "punctuation:"),
        ],
    )


def to_internal_segments(payload: SynthesizeRequestDto) -> list[InternalSegmentMetadata]:
    if not payload.metadata or not payload.metadata.segments:
        raise ValueError("metadata.segments are required")
    return [to_internal_segment(segment) for segment in payload.metadata.segments]
