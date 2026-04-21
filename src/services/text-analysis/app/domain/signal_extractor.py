from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

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


class SentenceIntent(str, Enum):
    INTERROGATIVE = "interrogative"
    DECLARATIVE = "declarative"
    IMPERATIVE = "imperative"


@dataclass(frozen=True)
class ExtractedSignals:
    cues: tuple[str, ...]
    sentence_intent: SentenceIntent
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
    has_positive_emoji = any(emoji in text for emoji in (*POSITIVE_EMOTICONS, *POSITIVE_UNICODE_EMOJIS))
    has_mixed_punctuation = "?!" in text or "!?" in text
    has_repeated_exclamation = "!!" in text
    has_repeated_question = "??" in text
    sentence_intent = _detect_sentence_intent(text, has_question)

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
    cues.append(f"intent:{sentence_intent.value}")

    return ExtractedSignals(
        cues=tuple(cues),
        sentence_intent=sentence_intent,
        has_exclamation=has_exclamation,
        has_question=has_question,
        has_ellipsis=has_ellipsis,
        has_positive_emoji=has_positive_emoji,
        has_mixed_punctuation=has_mixed_punctuation,
        has_repeated_exclamation=has_repeated_exclamation,
        has_repeated_question=has_repeated_question,
    )


def _detect_sentence_intent(text: str, has_question: bool) -> SentenceIntent:
    if has_question:
        return SentenceIntent.INTERROGATIVE

    normalized = text.strip().lower()
    if not normalized:
        return SentenceIntent.DECLARATIVE

    if normalized.startswith(("please ", "let's ", "do not ", "don't ")):
        return SentenceIntent.IMPERATIVE

    first_word = normalized.split(maxsplit=1)[0].strip("\"'([{")
    imperative_starters = {
        "be",
        "check",
        "close",
        "come",
        "do",
        "find",
        "give",
        "go",
        "keep",
        "listen",
        "look",
        "make",
        "move",
        "open",
        "read",
        "remember",
        "run",
        "send",
        "start",
        "stop",
        "take",
        "tell",
        "try",
        "turn",
        "wait",
        "write",
    }
    if first_word in imperative_starters:
        return SentenceIntent.IMPERATIVE

    return SentenceIntent.DECLARATIVE
