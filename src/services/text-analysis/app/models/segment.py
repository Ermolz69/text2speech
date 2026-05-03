from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.normalizer import normalize_text
from app.domain.signal_extractor import SentenceIntent


class Emotion(str, Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    CALM = "calm"
    EXCITED = "excited"
    SURPRISED = "surprised"


class PitchContourPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: float = Field(..., ge=0.0, le=1.0, description="Relative position in segment timeline.")
    shift: float = Field(
        ...,
        ge=-1.0,
        le=1.0,
        description="Relative pitch shift at position as a ratio, where +0.15 means +15%.",
    )


class SegmentMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, description="Normalized text for one segment.")
    emotion: Emotion = Field(default=Emotion.NEUTRAL)
    intensity: float = Field(default=0.0, ge=0.0, le=1.0)
    pause_ms: int = Field(default=0, ge=0, description="Pause after this segment in milliseconds.")
    rate: float = Field(default=1.0, gt=0.0, le=3.0, description="Relative speech rate multiplier.")
    pitch_hint: float = Field(
        default=0.0,
        ge=-12.0,
        le=12.0,
        description="Relative pitch shift hint in semitones.",
    )
    sentence_intent: SentenceIntent = Field(default=SentenceIntent.DECLARATIVE)
    pitch_contour: list[PitchContourPoint] = Field(
        default_factory=list,
        description="Dynamic pitch contour hint points over the segment.",
    )
    hesitation_markers: list[str] = Field(
        default_factory=list,
        description="Injected hesitation markers that should be synthesized softly.",
    )
    stressed_words: list[str] = Field(
        default_factory=list,
        description="Words that should be emphasized during synthesis.",
    )
    cues: list[str] = Field(default_factory=list, description="Raw cues that produced the metadata.")

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value

    @field_validator("cues")
    @classmethod
    def validate_cues(cls, value: list[str]) -> list[str]:
        cleaned = []
        for cue in value:
            cue = cue.strip()
            if cue:
                cleaned.append(cue)
        return cleaned

    @field_validator("stressed_words")
    @classmethod
    def validate_stressed_words(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for word in value:
            normalized = word.strip()
            if not normalized:
                continue
            dedupe_key = normalized.lower()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            cleaned.append(normalized)
        return cleaned

    @field_validator("hesitation_markers")
    @classmethod
    def validate_hesitation_markers(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        allowed_markers = {"um", "uh", "ah"}
        for marker in value:
            normalized = marker.strip().lower()
            if normalized not in allowed_markers:
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            cleaned.append(normalized)
        return cleaned


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1)

    @field_validator("text")
    @classmethod
    def normalize_request_text(cls, value: str) -> str:
        normalized = normalize_text(value)
        if not normalized:
            raise ValueError("text must not be blank")
        return normalized


class AnalyzeResponse(BaseModel):
    segments: list[SegmentMetadata]