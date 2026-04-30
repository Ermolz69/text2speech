"""
prosody_planner.py  –  text-analysis service

Annotates each segment produced by the segmenter with prosody hints
that downstream services (tts-adapter / Piper) can consume directly.

Changes in this revision
------------------------
* ``noise_scale`` is now included in every ``ProsodyHints`` object.
  The value is derived from the segment's detected emotion via
  ``emotion_noise_scale.get_noise_scale()``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from emotion_noise_scale import get_noise_scale


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class ProsodyHints:
    """Prosody parameters for a single text segment.

    All values are advisory; the tts-adapter may ignore any field it
    does not support.

    Attributes
    ----------
    noise_scale:
        Piper ``--noise-scale`` value.  Controls voice variability / jitter.
        Range ``[0.0, 1.0]``.  Higher → more expressive; lower → flatter.
    length_scale:
        Piper ``--length-scale`` value.  Controls speaking rate.
        ``1.0`` is the model default; ``> 1.0`` slows down, ``< 1.0`` speeds up.
    noise_w:
        Piper ``--noise-w`` (phoneme-duration noise).  Left at the model
        default (``0.8``) for now; can be wired up later.
    """

    noise_scale: float = 0.333
    length_scale: float = 1.0
    noise_w: float = 0.8


@dataclass
class SegmentAnalysis:
    """Analysis result for a single sentence-level segment."""

    text: str
    emotion: str
    prosody: ProsodyHints = field(default_factory=ProsodyHints)


# ---------------------------------------------------------------------------
# Prosody planner
# ---------------------------------------------------------------------------

# Emotion → length_scale (speaking rate) table.
# Excited/angry → faster; sad/calm → slower.
_EMOTION_LENGTH_SCALE: dict[str, float] = {
    "sad": 1.20,        # slower, drawn-out
    "calm": 1.10,       # slightly unhurried
    "neutral": 1.00,    # model default
    "bored": 1.15,
    "happy": 0.95,      # slightly brisker
    "surprised": 0.90,
    "curious": 1.00,
    "excited": 0.85,    # fast, energetic
    "anger": 0.80,      # clipped, rapid
    "fear": 0.90,
    "disgust": 0.95,
}

_DEFAULT_LENGTH_SCALE = 1.00


def plan_prosody(emotion: str) -> ProsodyHints:
    """Build a :class:`ProsodyHints` object for *emotion*.

    Parameters
    ----------
    emotion:
        Normalised emotion label (lower-case string).

    Returns
    -------
    ProsodyHints
        Ready-to-use prosody parameters for this emotion.
    """
    return ProsodyHints(
        noise_scale=get_noise_scale(emotion),
        length_scale=_EMOTION_LENGTH_SCALE.get(emotion, _DEFAULT_LENGTH_SCALE),
        noise_w=0.8,
    )


def annotate_segments(
    segments: Sequence[dict],
) -> list[SegmentAnalysis]:
    """Attach prosody hints to a list of analysis segments.

    Each element in *segments* must have at least:
    * ``"text"`` – the segment text
    * ``"emotion"`` – emotion label string

    Parameters
    ----------
    segments:
        Raw segment dicts from the emotion-detection pipeline.

    Returns
    -------
    list[SegmentAnalysis]
        Segments enriched with :class:`ProsodyHints`.
    """
    result: list[SegmentAnalysis] = []
    for seg in segments:
        emotion = str(seg.get("emotion", "neutral")).lower()
        result.append(
            SegmentAnalysis(
                text=seg["text"],
                emotion=emotion,
                prosody=plan_prosody(emotion),
            )
        )
    return result