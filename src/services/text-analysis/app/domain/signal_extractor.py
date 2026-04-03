from __future__ import annotations

from dataclasses import dataclass

POSITIVE_EMOJIS = (":)", ":D", "=)", "^^")


@dataclass(frozen=True)
class ExtractedSignals:
    cues: tuple[str, ...]
    has_exclamation: bool
    has_question: bool
    has_ellipsis: bool
    has_positive_emoji: bool
    has_mixed_punctuation: bool
    has_repeated_exclamation: bool
    has_repeated_question: bool


def extract_signals(text: str) -> ExtractedSignals:
    cues: list[str] = []
    has_exclamation = "!" in text
    has_question = "?" in text
    has_ellipsis = "..." in text
    has_positive_emoji = any(emoji in text for emoji in POSITIVE_EMOJIS)
    has_mixed_punctuation = "?!" in text or "!?" in text
    has_repeated_exclamation = "!!" in text
    has_repeated_question = "??" in text

    if has_exclamation:
        cues.append("punctuation:exclamation")
    if has_question:
        cues.append("punctuation:question")
    if has_positive_emoji:
        cues.append("emoji:positive")
    if has_ellipsis:
        cues.append("punctuation:ellipsis")
    if has_mixed_punctuation:
        cues.append("punctuation:mixed")
    if has_repeated_exclamation:
        cues.append("punctuation:repeated-exclamation")
    if has_repeated_question:
        cues.append("punctuation:repeated-question")

    return ExtractedSignals(
        cues=tuple(cues),
        has_exclamation=has_exclamation,
        has_question=has_question,
        has_ellipsis=has_ellipsis,
        has_positive_emoji=has_positive_emoji,
        has_mixed_punctuation=has_mixed_punctuation,
        has_repeated_exclamation=has_repeated_exclamation,
        has_repeated_question=has_repeated_question,
    )
