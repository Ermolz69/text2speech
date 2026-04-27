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

_BREATH_PAUSE_TAG = '<break time="300ms"/>'
_VOLUME_DIP_TAG = '<volume level="x-low">'
_VOLUME_RESTORE_TAG = "</volume>"

_CONJUNCTIONS = {"and", "but", "or", "nor", "for", "yet", "so", "because", "although", "while", "when", "if", "since"}
_BREAK_CHARS = {",", ";", ":", "—", "–"}

_MAX_WORDS_BEFORE_BREATH = 18
_MIN_WORDS_FOR_BREATH = 10


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
            segment = _inject_breath_pauses(segment)
            segments.append(segment)

        start = end
        while start < length and text[start].isspace():
            start += 1
        index = start

    tail = text[start:].strip()
    if tail:
        tail = _inject_breath_pauses(tail)
        segments.append(tail)

    return segments


def _inject_breath_pauses(segment: str) -> str:
    words = segment.split()
    if len(words) < _MAX_WORDS_BEFORE_BREATH:
        return segment

    break_points = _find_break_points(words)
    return _insert_breaths_at_breaks(words, break_points)


def _find_break_points(words: list[str]) -> list[int]:
    break_points = []
    for i, word in enumerate(words):
        clean = _clean_word(word).lower()
        if word.endswith(",") or word.endswith(";") or word.endswith(":"):
            break_points.append(i)
        elif clean in _CONJUNCTIONS and i > 0:
            break_points.append(i - 1)
        elif word in ("—", "–"):
            break_points.append(i)
    
    break_points.sort()
    return break_points


def _insert_breaths_at_breaks(words: list[str], break_points: list[int]) -> str:
    if not break_points:
        return " ".join(words)

    breath_tag = f" {_VOLUME_DIP_TAG} {_BREATH_PAUSE_TAG} {_VOLUME_RESTORE_TAG} "
    result_parts: list[str] = []
    chunk_start = 0

    remaining_breaks = list(break_points)
    while remaining_breaks and chunk_start < len(words):
        next_break = remaining_breaks.pop(0)
        if next_break < chunk_start:
            continue
        
        chunk_end = next_break + 1
        chunk_len = chunk_end - chunk_start
        
        if chunk_len >= _MIN_WORDS_FOR_BREATH or (not result_parts and len(words) >= _MAX_WORDS_BEFORE_BREATH):
            result_parts.append(" ".join(words[chunk_start:chunk_end]) + breath_tag)
            chunk_start = chunk_end

    if chunk_start < len(words):
        result_parts.append(" ".join(words[chunk_start:]))

    return "".join(result_parts)


def _clean_word(word: str) -> str:
    return word.strip(".,;:!?\"'()[]{}")


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
