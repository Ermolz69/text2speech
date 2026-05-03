"""Benchmark runner for corpus v1.

Runs the text-analysis service against the benchmark corpus and reports results.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "services" / "text-analysis"))

from app.domain.service import analyze_text
from app.models.segment import Emotion

CORPUS_PATH = Path(__file__).parent / "corpus_v1.json"
INTENSITY_TOLERANCE = 0.25


def load_corpus() -> dict:
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def emotion_matches(actual: Emotion, expected: str) -> bool:
    return actual.value == expected


def intensity_matches(actual: float, expected: float, tolerance: float = INTENSITY_TOLERANCE) -> bool:
    return abs(actual - expected) <= tolerance


def run_benchmark() -> dict:
    corpus = load_corpus()
    results = {
        "corpus_version": corpus["version"],
        "categories": {},
        "total_items": 0,
        "passed_items": 0,
        "failed_items": 0,
        "failures": [],
    }

    for category_name, category_data in corpus["categories"].items():
        category_results = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "items": [],
        }

        for item in category_data["items"]:
            category_results["total"] += 1
            results["total_items"] += 1

            try:
                response = analyze_text(item["text"])
                item_result = {
                    "id": item["id"],
                    "text": item["text"],
                    "passed": True,
                    "details": [],
                }

                if category_name == "multi-segment":
                    expected_segments = item.get("expected_segments", [])
                    if len(response.segments) != len(expected_segments):
                        item_result["passed"] = False
                        item_result["details"].append(
                            f"Expected {len(expected_segments)} segments, got {len(response.segments)}"
                        )
                    else:
                        for i, (actual_seg, expected_seg) in enumerate(
                            zip(response.segments, expected_segments)
                        ):
                            seg_details = {"segment_index": i}
                            seg_passed = True

                            if not emotion_matches(actual_seg.emotion, expected_seg["emotion"]):
                                seg_passed = False
                                seg_details["emotion_mismatch"] = {
                                    "expected": expected_seg["emotion"],
                                    "actual": actual_seg.emotion.value,
                                }

                            if not intensity_matches(
                                actual_seg.intensity, expected_seg["intensity"]
                            ):
                                seg_passed = False
                                seg_details["intensity_mismatch"] = {
                                    "expected": expected_seg["intensity"],
                                    "actual": actual_seg.intensity,
                                }

                            if not seg_passed:
                                item_result["passed"] = False
                                item_result["details"].append(seg_details)
                else:
                    expected_emotion = item["expected_emotion"]
                    expected_intensity = item["expected_intensity"]

                    first_segment = response.segments[0] if response.segments else None
                    if first_segment is None:
                        item_result["passed"] = False
                        item_result["details"].append("No segments returned")
                    else:
                        if not emotion_matches(first_segment.emotion, expected_emotion):
                            item_result["passed"] = False
                            item_result["details"].append(
                                {
                                    "emotion_mismatch": {
                                        "expected": expected_emotion,
                                        "actual": first_segment.emotion.value,
                                    }
                                }
                            )

                        if not intensity_matches(first_segment.intensity, expected_intensity):
                            item_result["passed"] = False
                            item_result["details"].append(
                                {
                                    "intensity_mismatch": {
                                        "expected": expected_intensity,
                                        "actual": first_segment.intensity,
                                    }
                                }
                            )

                if item_result["passed"]:
                    category_results["passed"] += 1
                    results["passed_items"] += 1
                else:
                    category_results["failed"] += 1
                    results["failed_items"] += 1
                    results["failures"].append(item_result)

                category_results["items"].append(item_result)

            except Exception as e:
                category_results["failed"] += 1
                results["failed_items"] += 1
                results["failures"].append(
                    {
                        "id": item["id"],
                        "text": item["text"],
                        "passed": False,
                        "error": str(e),
                    }
                )

        results["categories"][category_name] = category_results

    return results


def print_results(results: dict) -> None:
    print(f"\n{'='*60}")
    print(f"Benchmark Results (corpus v{results['corpus_version']})")
    print(f"{'='*60}\n")

    for category_name, category_data in results["categories"].items():
        total = category_data["total"]
        passed = category_data["passed"]
        failed = category_data["failed"]
        pct = (passed / total * 100) if total > 0 else 0

        print(f"Category: {category_name}")
        print(f"  Passed: {passed}/{total} ({pct:.1f}%)")

        if failed > 0:
            for item in category_data["items"]:
                if not item["passed"]:
                    print(f"  FAILED: {item['id']}")
                    for detail in item.get("details", []):
                        print(f"    - {detail}")
        print()

    total = results["total_items"]
    passed = results["passed_items"]
    failed = results["failed_items"]
    pct = (passed / total * 100) if total > 0 else 0

    print(f"{'='*60}")
    print(f"Total: {passed}/{total} passed ({pct:.1f}%)")
    print(f"{'='*60}\n")


def main():
    results = run_benchmark()
    print_results(results)

    if results["failed_items"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
