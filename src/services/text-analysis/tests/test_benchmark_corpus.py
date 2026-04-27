"""Tests for the benchmark corpus v1.

Verifies that the text-analysis service produces expected results for all corpus items.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.domain.service import analyze_text

CORPUS_PATH = Path(__file__).parent.parent.parent.parent.parent / "benchmarks" / "corpus_v1.json"
INTENSITY_TOLERANCE = 0.25


def load_corpus() -> dict:
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_corpus_items():
    corpus = load_corpus()
    items = []
    for category_name, category_data in corpus["categories"].items():
        for item in category_data["items"]:
            items.append((category_name, item))
    return items


class TestBenchmarkCorpusNeutral:
    @pytest.mark.parametrize(
        "item",
        [item for item in load_corpus_items() if item[0] == "neutral"],
        ids=lambda x: x[1]["id"],
    )
    def test_neutral_items(self, item):
        _, data = item
        response = analyze_text(data["text"])

        assert len(response.segments) >= 1, f"No segments for: {data['text']}"

        first_segment = response.segments[0]
        assert first_segment.emotion.value == data["expected_emotion"], (
            f"Emotion mismatch for {data['id']}: "
            f"expected {data['expected_emotion']}, got {first_segment.emotion.value}"
        )
        assert abs(first_segment.intensity - data["expected_intensity"]) <= INTENSITY_TOLERANCE, (
            f"Intensity mismatch for {data['id']}: "
            f"expected {data['expected_intensity']}, got {first_segment.intensity}"
        )


class TestBenchmarkCorpusAmplified:
    @pytest.mark.parametrize(
        "item",
        [item for item in load_corpus_items() if item[0] == "amplified"],
        ids=lambda x: x[1]["id"],
    )
    def test_amplified_items(self, item):
        _, data = item
        response = analyze_text(data["text"])

        assert len(response.segments) >= 1, f"No segments for: {data['text']}"

        first_segment = response.segments[0]
        assert first_segment.emotion.value == data["expected_emotion"], (
            f"Emotion mismatch for {data['id']}: "
            f"expected {data['expected_emotion']}, got {first_segment.emotion.value}"
        )
        assert abs(first_segment.intensity - data["expected_intensity"]) <= INTENSITY_TOLERANCE, (
            f"Intensity mismatch for {data['id']}: "
            f"expected {data['expected_intensity']}, got {first_segment.intensity}"
        )


class TestBenchmarkCorpusAmbiguous:
    @pytest.mark.parametrize(
        "item",
        [item for item in load_corpus_items() if item[0] == "ambiguous"],
        ids=lambda x: x[1]["id"],
    )
    def test_ambiguous_items(self, item):
        _, data = item
        response = analyze_text(data["text"])

        assert len(response.segments) >= 1, f"No segments for: {data['text']}"

        first_segment = response.segments[0]
        assert first_segment.emotion.value == data["expected_emotion"], (
            f"Emotion mismatch for {data['id']}: "
            f"expected {data['expected_emotion']}, got {first_segment.emotion.value}"
        )
        assert abs(first_segment.intensity - data["expected_intensity"]) <= INTENSITY_TOLERANCE, (
            f"Intensity mismatch for {data['id']}: "
            f"expected {data['expected_intensity']}, got {first_segment.intensity}"
        )


class TestBenchmarkCorpusMultiSegment:
    @pytest.mark.parametrize(
        "item",
        [item for item in load_corpus_items() if item[0] == "multi-segment"],
        ids=lambda x: x[1]["id"],
    )
    def test_multi_segment_items(self, item):
        _, data = item
        response = analyze_text(data["text"])

        expected_segments = data.get("expected_segments", [])
        assert len(response.segments) == len(expected_segments), (
            f"Segment count mismatch for {data['id']}: "
            f"expected {len(expected_segments)}, got {len(response.segments)}"
        )

        for i, (actual_seg, expected_seg) in enumerate(
            zip(response.segments, expected_segments)
        ):
            assert actual_seg.emotion.value == expected_seg["emotion"], (
                f"Emotion mismatch for {data['id']} segment {i}: "
                f"expected {expected_seg['emotion']}, got {actual_seg.emotion.value}"
            )
            assert abs(actual_seg.intensity - expected_seg["intensity"]) <= INTENSITY_TOLERANCE, (
                f"Intensity mismatch for {data['id']} segment {i}: "
                f"expected {expected_seg['intensity']}, got {actual_seg.intensity}"
            )
