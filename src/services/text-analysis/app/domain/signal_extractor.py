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


def extract_signals(text: str) -> ExtractedSignals:
    cues: list[str] = []
    has_exclamation = "!" in text
    has_question = "?" in text
    has_ellipsis = "..." in text
    has_positive_emoji = any(emoji in text for emoji in POSITIVE_EMOJIS)

    if has_exclamation:
        cues.append("punctuation:exclamation")
    if has_question:
        cues.append("punctuation:question")
    if has_positive_emoji:
        cues.append("emoji:positive")
    if has_ellipsis:
        cues.append("punctuation:ellipsis")

    return ExtractedSignals(
        cues=tuple(cues),
        has_exclamation=has_exclamation,
        has_question=has_question,
        has_ellipsis=has_ellipsis,
        has_positive_emoji=has_positive_emoji,
    )
