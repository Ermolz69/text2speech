from __future__ import annotations

import pytest

from app.emotion_noise_scale import get_noise_scale, DEFAULT_NOISE_SCALE, EMOTION_NOISE_SCALE


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


class TestAcceptanceCriteria:
    SAD_MAX_NOISE_SCALE = 0.25
    HIGH_ENERGY_MIN_NOISE_SCALE = 0.70

    def test_sad_has_low_noise_scale(self):
        assert get_noise_scale("sad") <= self.SAD_MAX_NOISE_SCALE

    def test_excited_has_high_noise_scale(self):
        assert get_noise_scale("excited") >= self.HIGH_ENERGY_MIN_NOISE_SCALE

    def test_anger_has_high_noise_scale(self):
        assert get_noise_scale("anger") >= self.HIGH_ENERGY_MIN_NOISE_SCALE

    def test_angry_has_high_noise_scale(self):
        assert get_noise_scale("angry") >= self.HIGH_ENERGY_MIN_NOISE_SCALE

    def test_excited_higher_than_sad(self):
        assert get_noise_scale("excited") > get_noise_scale("sad")

    def test_anger_higher_than_neutral(self):
        assert get_noise_scale("anger") > get_noise_scale("neutral")

    def test_sad_lower_than_neutral(self):
        assert get_noise_scale("sad") < get_noise_scale("neutral")