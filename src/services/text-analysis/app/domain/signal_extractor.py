from __future__ import annotations

import re
from dataclasses import dataclass

POSITIVE_EMOTICONS = (":)", ":D", "=)", "^^")
POSITIVE_UNICODE_EMOJIS = (
    "\U0001F60A",
    "\U0001F604",
    "\U0001F603",
    "\U0001F642",
    "\U0001F601",
    "\U0001F606",
    "\U0001F609",
    "\U0001F60D",
    "\U0001F970",
)

NEGATIVE_UNICODE_EMOJIS = (
    "\U0001F622",
    "\U0001F62D",
    "\U0001F614",
    "\U0001F61E",
    "\U0001F61F",
    "\U0001F620",
    "\U0001F621",
    "\U0001F624",
    "\U0001F628",
    "\U0001F631",
    "\U0001F62E",
)

SURPRISE_UNICODE_EMOJIS = (
    "\U0001F632",
    "\U0001F631",
    "\U0001F92F",
)

CELEBRATION_UNICODE_EMOJIS = (
    "\U0001F389",
    "\U0001F38A",
    "\U0001F31E",
    "\U0001F31F",
    "\U0001F4A5",
    "\U0001F525",
    "\U0001F44F",
)


@dataclass(frozen=True)
class ExtractedSignals:
    cues: tuple[str, ...]
    has_exclamation: bool
    has_question: bool
    has_ellipsis: bool
    has_positive_emoji: bool
    has_negative_emoji: bool
    has_surprise_emoji: bool
    has_celebration_emoji: bool
    has_mixed_punctuation: bool
    has_repeated_exclamation: bool
    has_repeated_question: bool
    is_all_caps: bool
    exclamation_count: int
    question_count: int


def _count_pattern(text: str, pattern: str) -> int:
    return len(re.findall(re.escape(pattern), text))


def extract_signals(text: str) -> ExtractedSignals:
    cues: list[str] = []
    has_exclamation = "!" in text
    has_question = "?" in text
    has_ellipsis = "..." in text
    has_positive_emoji = any(emoji in text for emoji in (*POSITIVE_EMOTICONS, *POSITIVE_UNICODE_EMOJIS))
    has_negative_emoji = any(emoji in text for emoji in NEGATIVE_UNICODE_EMOJIS)
    has_surprise_emoji = any(emoji in text for emoji in SURPRISE_UNICODE_EMOJIS)
    has_celebration_emoji = any(emoji in text for emoji in CELEBRATION_UNICODE_EMOJIS)
    has_mixed_punctuation = "?!" in text or "!?" in text
    has_repeated_exclamation = "!!" in text
    has_repeated_question = "??" in text
    is_all_caps = bool(re.search(r"[A-Z]", text)) and text == text.upper()
    exclamation_count = _count_pattern(text, "!")
    question_count = _count_pattern(text, "?")

    if has_exclamation:
        cues.append("punctuation:exclamation")
    if has_question:
        cues.append("punctuation:question")
    if has_positive_emoji:
        cues.append("emoji:positive")
    if has_negative_emoji:
        cues.append("emoji:negative")
    if has_surprise_emoji:
        cues.append("emoji:surprise")
    if has_celebration_emoji:
        cues.append("emoji:celebration")
    if has_ellipsis:
        cues.append("punctuation:ellipsis")
    if has_mixed_punctuation:
        cues.append("punctuation:mixed")
    if has_repeated_exclamation:
        cues.append("punctuation:repeated-exclamation")
    if has_repeated_question:
        cues.append("punctuation:repeated-question")
    if is_all_caps:
        cues.append("caps:all")

    return ExtractedSignals(
        cues=tuple(cues),
        has_exclamation=has_exclamation,
        has_question=has_question,
        has_ellipsis=has_ellipsis,
        has_positive_emoji=has_positive_emoji,
        has_negative_emoji=has_negative_emoji,
        has_surprise_emoji=has_surprise_emoji,
        has_celebration_emoji=has_celebration_emoji,
        has_mixed_punctuation=has_mixed_punctuation,
        has_repeated_exclamation=has_repeated_exclamation,
        has_repeated_question=has_repeated_question,
        is_all_caps=is_all_caps,
        exclamation_count=exclamation_count,
        question_count=question_count,
    )
