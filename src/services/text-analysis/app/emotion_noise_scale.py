"""
Emotion → Piper noise_scale mapping.

Piper's --noise-scale flag controls the variability (jitter) of the
synthesised voice.  Lower values produce a flatter, more monotone
delivery; higher values introduce more pitch variation and texture.

Reference ranges
----------------
  0.0   – completely flat (robot-like)
  0.333 – Piper's built-in default
  0.667 – noticeably more expressive
  1.0   – maximum jitter / variability

This module is consumed by both the text-analysis prosody planner
(to annotate segments) and by the tts-adapter Piper provider
(to pass the flag to the CLI).
"""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# Canonical emotion → noise_scale table
# ---------------------------------------------------------------------------

EMOTION_NOISE_SCALE: Final[dict[str, float]] = {
    # ── Calm / subdued emotions ──────────────────────────────────────────
    "sad": 0.05,          # майже повністю плоский
    "sadness": 0.05,
    "calm": 0.10,
    "neutral": 0.333,
    "bored": 0.15,

    # ── Moderately expressive ────────────────────────────────────────────
    "happy": 0.60,
    "joy": 0.65,
    "surprised": 0.70,
    "curious": 0.55,

    # ── High-energy / volatile emotions ─────────────────────────────────
    "excited": 0.95,      # майже максимум
    "angry": 1.0,         # максимальний jitter
    "anger": 1.0,
    "fear": 0.90,
    "disgust": 0.85,
}

# Default used when an unrecognised emotion label is encountered.
DEFAULT_NOISE_SCALE: Final[float] = EMOTION_NOISE_SCALE["neutral"]


def get_noise_scale(emotion: str) -> float:
    """Return the noise_scale for *emotion*.

    The lookup is case-insensitive and strips surrounding whitespace.
    Falls back to ``DEFAULT_NOISE_SCALE`` for unknown labels.

    Parameters
    ----------
    emotion:
        Emotion label produced by the text-analysis service
        (e.g. ``"sad"``, ``"excited"``, ``"anger"``).

    Returns
    -------
    float
        A value in ``[0.0, 1.0]`` suitable for Piper's ``--noise-scale``.

    Examples
    --------
    >>> get_noise_scale("sad")
    0.15
    >>> get_noise_scale("EXCITED")
    0.8
    >>> get_noise_scale("unknown_label")
    0.333
    """
    return EMOTION_NOISE_SCALE.get(emotion.strip().lower(), DEFAULT_NOISE_SCALE)