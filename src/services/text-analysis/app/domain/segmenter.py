from __future__ import annotations

_ABBREVIATIONS = {
    "dr.",
    "mr.",
    "mrs.",
    "ms.",
    "prof.",
    "e.g.",
    "i.e.",
}

_EMOTICONS = (":)", ":-)", ":D", ":-D", ";)", ";-)", ":(", ":-(")
_TRAILING_CUE_CHARS = {')', ']', '}', '"', "'"}


def split_segments(text: str) -> list[str]:
    if not text:
        return []

    segments: list[str] = []
    start = 0
    index = 0
    length = len(text)

    while index < length:
        boundary_len = _boundary_length(text, index)
        if boundary_len == 0:
            index += 1
            continue

        end = index + boundary_len
        if _is_abbreviation_boundary(text, index, end):
            index = end
            continue

        end = _consume_trailing_cues(text, end)
        segment = text[start:end].strip()
        if segment:
            segments.append(segment)

        start = end
        while start < length and text[start].isspace():
            start += 1
        index = start

    tail = text[start:].strip()
    if tail:
        segments.append(tail)

    return segments


def _boundary_length(text: str, index: int) -> int:
    if text.startswith("...", index):
        return 3
    if text.startswith("?!", index) or text.startswith("!?", index):
        return 2
    if text[index] in ".!?":
        return 1
    return 0


def _is_abbreviation_boundary(text: str, index: int, end: int) -> bool:
    token_start = index
    while token_start > 0 and not text[token_start - 1].isspace():
        token_start -= 1

    return text[token_start:end].lower() in _ABBREVIATIONS


def _consume_trailing_cues(text: str, index: int) -> int:
    length = len(text)
    cursor = index

    while cursor < length and text[cursor].isspace():
        next_cursor = cursor
        while next_cursor < length and text[next_cursor].isspace():
            next_cursor += 1

        cue_end = _consume_emoticon(text, next_cursor)
        if cue_end != next_cursor:
            cursor = cue_end
            continue

        cue_end = _consume_emoji(text, next_cursor)
        if cue_end != next_cursor:
            cursor = cue_end
            continue

        break

    return cursor


def _consume_emoticon(text: str, index: int) -> int:
    for emoticon in _EMOTICONS:
        if text.startswith(emoticon, index):
            return index + len(emoticon)

    return index


def _consume_emoji(text: str, index: int) -> int:
    cursor = index
    consumed = False

    while cursor < len(text):
        char = text[cursor]
        if char in _TRAILING_CUE_CHARS:
            cursor += 1
            continue
        if _is_emoji(char):
            consumed = True
            cursor += 1
            continue
        break

    return cursor if consumed else index


def _is_emoji(char: str) -> bool:
    codepoint = ord(char)
    return (
        0x1F300 <= codepoint <= 0x1FAFF
        or 0x2600 <= codepoint <= 0x27BF
        or 0xFE00 <= codepoint <= 0xFE0F
    )
