from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Emotion(str, Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    CALM = "calm"
    EXCITED = "excited"
    SURPRISED = "surprised"


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
    cues: list[str] = Field(default_factory=list, description="Raw cues that produced the metadata.")

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("text must not be blank")
        return normalized

    @field_validator("cues")
    @classmethod
    def validate_cues(cls, value: list[str]) -> list[str]:
        cleaned = []
        for cue in value:
            cue = cue.strip()
            if cue:
                cleaned.append(cue)
        return cleaned


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(..., min_length=1)


class AnalyzeResponse(BaseModel):
    segments: list[SegmentMetadata]