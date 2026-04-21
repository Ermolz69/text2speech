from __future__ import annotations

import re

from app.domain.mapper import map_emotion
from app.domain.signal_extractor import ExtractedSignals, SentenceIntent
from app.models.segment import SegmentMetadata

UPPERCASE_WORD_RE = re.compile(r"\b[\w'-]+\b")
ASTERISK_MARKED_WORD_RE = re.compile(r"\*([\w'-]+)\*")
UNDERSCORE_MARKED_WORD_RE = re.compile(r"_([\w'-]+)_")


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

    stressed_words = _extract_stressed_words(text)
    hesitation_markers = _extract_hesitation_markers(text, signals)
    cues = list(signals.cues)
    cues.extend(f"emphasis:{word.lower()}" for word in stressed_words)
    cues.extend(f"hesitation:{marker}" for marker in hesitation_markers)

    pitch_contour = _build_pitch_contour(signals)

    return SegmentMetadata(
        text=text,
        emotion=mapped.emotion,
        intensity=mapped.intensity,
        pause_ms=pause_ms,
        rate=rate,
        pitch_hint=pitch_hint,
        sentence_intent=signals.sentence_intent,
        pitch_contour=pitch_contour,
        hesitation_markers=hesitation_markers,
        stressed_words=stressed_words,
        cues=cues,
    )


def _extract_stressed_words(text: str) -> list[str]:
    marked_words: list[str] = []
    for match in ASTERISK_MARKED_WORD_RE.finditer(text):
        marked_words.append(match.group(1))
    for match in UNDERSCORE_MARKED_WORD_RE.finditer(text):
        marked_words.append(match.group(1))

    uppercase_words = [
        token
        for token in UPPERCASE_WORD_RE.findall(text)
        if _is_uppercase_word(token)
    ]

    stressed_words: list[str] = []
    seen: set[str] = set()
    for word in [*marked_words, *uppercase_words]:
        normalized = word.strip("_*")
        if not normalized:
            continue
        dedupe_key = normalized.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        stressed_words.append(normalized)

    return stressed_words


def _is_uppercase_word(token: str) -> bool:
    letters = [char for char in token if char.isalpha()]
    if len(letters) < 2:
        return False
    return all(char.isupper() for char in letters)


def _extract_hesitation_markers(text: str, signals: ExtractedSignals) -> list[str]:
    normalized = text.strip()
    if not normalized:
        return []

    if signals.has_ellipsis:
        return ["uh"]

    word_count = len(normalized.split())
    clause_delimiters = normalized.count(",") + normalized.count(";") + normalized.count(":")
    if word_count >= 12 or clause_delimiters >= 2:
        return ["um"]

    return []


def _build_pitch_contour(signals: ExtractedSignals) -> list[dict[str, float]]:
    if signals.has_question or signals.sentence_intent is SentenceIntent.INTERROGATIVE:
        # Rise by +15% over the last 20% for a classic question ending.
        return [
            {"position": 0.0, "shift": 0.0},
            {"position": 0.8, "shift": 0.0},
            {"position": 1.0, "shift": 0.15},
        ]

    if signals.has_exclamation:
        # Exclamation starts energetic (+20%) and drops quickly.
        return [
            {"position": 0.0, "shift": 0.2},
            {"position": 0.35, "shift": 0.05},
            {"position": 1.0, "shift": -0.08},
        ]

    if signals.sentence_intent is SentenceIntent.IMPERATIVE:
        return [
            {"position": 0.0, "shift": 0.08},
            {"position": 1.0, "shift": -0.06},
        ]

    # Declaratives gently fall toward the end.
    return [
        {"position": 0.0, "shift": 0.04},
        {"position": 1.0, "shift": -0.1},
    ]
