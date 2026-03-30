from __future__ import annotations

from app.domain.normalizer import normalize_text
from app.domain.planner import plan_segment
from app.domain.segmenter import split_segments
from app.domain.signal_extractor import extract_signals
from app.models.segment import AnalyzeResponse


def analyze_text(text: str) -> AnalyzeResponse:
    normalized_text = normalize_text(text)
    segments = split_segments(normalized_text)

    return AnalyzeResponse(
        segments=[
            plan_segment(segment_text, extract_signals(segment_text)) for segment_text in segments
        ]
    )
