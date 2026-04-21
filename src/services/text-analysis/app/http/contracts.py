from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.normalizer import normalize_text
from app.models.segment import AnalyzeResponse as InternalAnalyzeResponse
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


class AnalyzeRequestDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1)

    @field_validator("text")
    @classmethod
    def normalize_request_text(cls, value: str) -> str:
        normalized = normalize_text(value)
        if not normalized:
            raise ValueError("text must not be blank")
        return normalized


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
    sentenceIntent: str | None = None
    pitchContour: list[dict[str, float]] | None = None
    hesitationMarkers: list[str] | None = None
    stressedWords: list[str] | None = None


class AnalyzeResponseDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    segments: list[AnalyzeSegmentDto]


def _map_emotion(emotion: InternalEmotion) -> SharedEmotionLabel:
    match emotion:
        case InternalEmotion.HAPPY | InternalEmotion.EXCITED:
            return SharedEmotionLabel.JOY
        case InternalEmotion.SAD:
            return SharedEmotionLabel.SADNESS
        case InternalEmotion.ANGRY:
            return SharedEmotionLabel.ANGER
        case InternalEmotion.SURPRISED:
            return SharedEmotionLabel.SURPRISE
        case InternalEmotion.CALM | InternalEmotion.NEUTRAL:
            return SharedEmotionLabel.NEUTRAL


def _map_intensity(intensity: float) -> int:
    clamped = max(0.0, min(1.0, intensity))
    if clamped < 0.25:
        return 0
    if clamped < 0.5:
        return 1
    if clamped < 0.75:
        return 2
    return 3


def _pick_cue_values(cues: list[str], prefix: str) -> list[str] | None:
    values = [
        cue[len(prefix) :]
        for cue in cues
        if cue.startswith(prefix) and len(cue) > len(prefix)
    ]
    return values or None


def to_analyze_segment_dto(segment: InternalSegmentMetadata) -> AnalyzeSegmentDto:
    return AnalyzeSegmentDto(
        text=segment.text,
        emotion=_map_emotion(segment.emotion),
        intensity=_map_intensity(segment.intensity),
        emoji=_pick_cue_values(segment.cues, "emoji:"),
        punctuation=_pick_cue_values(segment.cues, "punctuation:"),
        pauseAfterMs=segment.pause_ms,
        rate=segment.rate,
        pitchHint=segment.pitch_hint,
        sentenceIntent=segment.sentence_intent.value,
        pitchContour=[point.model_dump() for point in segment.pitch_contour],
        hesitationMarkers=segment.hesitation_markers or None,
        stressedWords=segment.stressed_words or None,
    )


def to_analyze_response_dto(response: InternalAnalyzeResponse) -> AnalyzeResponseDto:
    return AnalyzeResponseDto(
        segments=[to_analyze_segment_dto(segment) for segment in response.segments]
    )
