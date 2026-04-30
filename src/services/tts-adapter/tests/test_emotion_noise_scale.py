"""
tests/test_emotion_noise_scale.py

Unit tests covering:
  1. emotion_noise_scale.get_noise_scale()  — mapping table & fallback
  2. prosody_planner.plan_prosody()         — correct noise_scale per emotion
  3. prosody_planner.annotate_segments()   — enriches segment list
  4. Acceptance-criteria assertions:
       sad     → noise_scale ≤ 0.25   (flat, monotone)
       excited → noise_scale ≥ 0.70   (high jitter)
       anger   → noise_scale ≥ 0.70   (high jitter)
"""

from __future__ import annotations

import sys
import os
import pytest

# Allow importing the modules from the parent directory when running directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.emotion_noise_scale import get_noise_scale, DEFAULT_NOISE_SCALE, EMOTION_NOISE_SCALE

# ---------------------------------------------------------------------------
# get_noise_scale
# ---------------------------------------------------------------------------

class TestGetNoiseScale:
    def test_known_emotions_return_expected_values(self):
        for emotion, expected in EMOTION_NOISE_SCALE.items():
            assert get_noise_scale(emotion) == pytest.approx(expected)

    def test_case_insensitive(self):
        assert get_noise_scale("SAD") == get_noise_scale("sad")
        assert get_noise_scale("Excited") == get_noise_scale("excited")
        assert get_noise_scale("ANGER") == get_noise_scale("anger")

    def test_strips_whitespace(self):
        assert get_noise_scale("  sad  ") == get_noise_scale("sad")

    def test_unknown_emotion_returns_default(self):
        assert get_noise_scale("perplexed") == pytest.approx(DEFAULT_NOISE_SCALE)
        assert get_noise_scale("") == pytest.approx(DEFAULT_NOISE_SCALE)


# ---------------------------------------------------------------------------
# Acceptance criteria: sad must be flat, excited/anger must be high
# ---------------------------------------------------------------------------

class TestAcceptanceCriteria:
    """Directly encode the task acceptance criteria as test cases."""

    SAD_MAX_NOISE_SCALE = 0.25
    HIGH_ENERGY_MIN_NOISE_SCALE = 0.70

    def test_sad_has_low_noise_scale(self):
        """Sad segments must have a noise_scale ≤ 0.25 (flat, monotone)."""
        ns = get_noise_scale("sad")
        assert ns <= self.SAD_MAX_NOISE_SCALE, (
            f"Expected noise_scale for 'sad' ≤ {self.SAD_MAX_NOISE_SCALE}, got {ns}"
        )

    def test_excited_has_high_noise_scale(self):
        """Excited segments must have a noise_scale ≥ 0.70 (more jitter)."""
        ns = get_noise_scale("excited")
        assert ns >= self.HIGH_ENERGY_MIN_NOISE_SCALE, (
            f"Expected noise_scale for 'excited' ≥ {self.HIGH_ENERGY_MIN_NOISE_SCALE}, got {ns}"
        )

    def test_anger_has_high_noise_scale(self):
        """Angry segments must have a noise_scale ≥ 0.70 (more jitter)."""
        ns = get_noise_scale("anger")
        assert ns >= self.HIGH_ENERGY_MIN_NOISE_SCALE, (
            f"Expected noise_scale for 'anger' ≥ {self.HIGH_ENERGY_MIN_NOISE_SCALE}, got {ns}"
        )

    def test_excited_louder_than_sad(self):
        """Excited must always have a higher noise_scale than sad."""
        assert get_noise_scale("excited") > get_noise_scale("sad")

    def test_anger_louder_than_neutral(self):
        assert get_noise_scale("anger") > get_noise_scale("neutral")

    def test_sad_quieter_than_neutral(self):
        assert get_noise_scale("sad") < get_noise_scale("neutral")


# ---------------------------------------------------------------------------
# plan_prosody
# ---------------------------------------------------------------------------

class TestPlanProsody:
    def test_returns_prosody_hints_object(self):
        hints = plan_prosody("neutral")
        assert hasattr(hints, "noise_scale")
        assert hasattr(hints, "length_scale")
        assert hasattr(hints, "noise_w")

    def test_noise_scale_matches_mapping(self):
        for emotion in ("sad", "excited", "anger", "happy", "neutral"):
            hints = plan_prosody(emotion)
            assert hints.noise_scale == pytest.approx(get_noise_scale(emotion))

    def test_sad_length_scale_is_slower(self):
        """Sad speech should be slower than excited speech."""
        sad_hints = plan_prosody("sad")
        excited_hints = plan_prosody("excited")
        assert sad_hints.length_scale > excited_hints.length_scale

    def test_noise_w_is_positive(self):
        for emotion in EMOTION_NOISE_SCALE:
            assert plan_prosody(emotion).noise_w > 0


# ---------------------------------------------------------------------------
# annotate_segments
# ---------------------------------------------------------------------------

class TestAnnotateSegments:
    def _make_segments(self, *emotion_text_pairs):
        return [
            {"text": text, "emotion": emotion}
            for emotion, text in emotion_text_pairs
        ]

    def test_single_segment(self):
        segments = self._make_segments(("sad", "I miss you so much."))
        result = annotate_segments(segments)
        assert len(result) == 1
        assert result[0].emotion == "sad"
        assert result[0].prosody.noise_scale == pytest.approx(get_noise_scale("sad"))

    def test_multiple_segments_preserve_order(self):
        segments = self._make_segments(
            ("sad", "She cried silently."),
            ("excited", "Then the door burst open!"),
            ("anger", "He slammed his fist down."),
        )
        result = annotate_segments(segments)
        assert [r.emotion for r in result] == ["sad", "excited", "anger"]

    def test_each_segment_has_correct_noise_scale(self):
        pairs = [("sad", "txt"), ("excited", "txt"), ("neutral", "txt")]
        segments = self._make_segments(*pairs)
        result = annotate_segments(segments)
        for seg_result, (emotion, _) in zip(result, pairs):
            assert seg_result.prosody.noise_scale == pytest.approx(
                get_noise_scale(emotion)
            )

    def test_missing_emotion_defaults_to_neutral(self):
        segments = [{"text": "Hello world."}]  # no 'emotion' key
        result = annotate_segments(segments)
        assert result[0].emotion == "neutral"
        assert result[0].prosody.noise_scale == pytest.approx(DEFAULT_NOISE_SCALE)

    def test_empty_segments_list(self):
        assert annotate_segments([]) == []