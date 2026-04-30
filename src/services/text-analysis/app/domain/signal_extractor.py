from __future__ import annotations

from dataclasses import dataclass

POSITIVE_EMOJIS_TEXT = (":)", ":D", "=)", "^^")
NEGATIVE_EMOJIS_TEXT = (":(", ":-(", ":'(")

POSITIVE_EMOJIS_UNICODE = ("😀", "😃", "😄", "😁", "😆", "😊", "🙂", "😍", "🥰", "😎", "🎉", "🎊", "❤️", "💕", "👍")
NEGATIVE_EMOJIS_UNICODE = ("😢", "😭", "😔", "😞", "😟", "😿", "💔", "🥺", "😥", "😓")
ANGRY_EMOJIS_UNICODE = ("😡", "🤬", "😤", "💢", "👿")
EXCITED_EMOJIS_UNICODE = ("🤩", "😱", "🙌", "🔥", "⚡", "💥", "🎯")


@dataclass(frozen=True)
class ExtractedSignals:
    cues: tuple[str, ...]
    has_exclamation: bool
    has_question: bool
    has_ellipsis: bool
    has_positive_emoji: bool
    has_negative_emoji: bool
    has_angry_emoji: bool
    has_excited_emoji: bool
    has_mixed_punctuation: bool
    has_repeated_exclamation: bool
    has_repeated_question: bool


def extract_signals(text: str) -> ExtractedSignals:
    cues: list[str] = []

    has_exclamation = "!" in text
    has_question = "?" in text
    has_ellipsis = "..." in text
    has_mixed_punctuation = "?!" in text or "!?" in text
    has_repeated_exclamation = "!!" in text
    has_repeated_question = "??" in text

    has_positive_emoji = (
        any(e in text for e in POSITIVE_EMOJIS_TEXT) or
        any(e in text for e in POSITIVE_EMOJIS_UNICODE)
    )
    has_negative_emoji = (
        any(e in text for e in NEGATIVE_EMOJIS_TEXT) or
        any(e in text for e in NEGATIVE_EMOJIS_UNICODE)
    )
    has_angry_emoji = any(e in text for e in ANGRY_EMOJIS_UNICODE)
    has_excited_emoji = any(e in text for e in EXCITED_EMOJIS_UNICODE)

    if has_exclamation:
        cues.append("punctuation:exclamation")
    if has_question:
        cues.append("punctuation:question")
    if has_positive_emoji:
        cues.append("emoji:positive")
    if has_negative_emoji:
        cues.append("emoji:negative")
    if has_angry_emoji:
        cues.append("emoji:angry")
    if has_excited_emoji:
        cues.append("emoji:excited")
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
        has_negative_emoji=has_negative_emoji,
        has_angry_emoji=has_angry_emoji,
        has_excited_emoji=has_excited_emoji,
        has_mixed_punctuation=has_mixed_punctuation,
        has_repeated_exclamation=has_repeated_exclamation,
        has_repeated_question=has_repeated_question,
    )