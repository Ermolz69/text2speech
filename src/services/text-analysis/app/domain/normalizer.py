from __future__ import annotations

import re

_COLLAPSE_WHITESPACE_RE = re.compile(r"[\s\u00A0\u200B]+")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,!?;.])")

_REPEAT_EXCL_RE = re.compile(r"!{2,}")
_REPEAT_QUEST_RE = re.compile(r"\?{2,}")
_REPEAT_COMMA_RE = re.compile(r",{2,}")
_REPEAT_SEMI_RE = re.compile(r";{2,}")
_REPEAT_COLON_RE = re.compile(r":{2,}")
_REPEAT_DOT_RE = re.compile(r"\.{4,}")


def normalize_text(text: str) -> str:
    value = text.replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\u00A0", " ")
    value = value.replace("\u200B", "")
    value = value.replace("\u2026", "...")

    value = _COLLAPSE_WHITESPACE_RE.sub(" ", value)
    value = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", value)

    value = _REPEAT_DOT_RE.sub("...", value)
    value = _REPEAT_EXCL_RE.sub("!", value)
    value = _REPEAT_QUEST_RE.sub("?", value)
    value = _REPEAT_COMMA_RE.sub(",", value)
    value = _REPEAT_SEMI_RE.sub(";", value)
    value = _REPEAT_COLON_RE.sub(":", value)

    return value.strip()