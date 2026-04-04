import pytest

from app.domain.planner import plan_segment
from app.domain.signal_extractor import ExtractedSignals


def test_plan_segment_combines_emotion_and_prosody_rules() -> None:
    segment = plan_segment(
        "Hello! :) ...?",
        ExtractedSignals(
            cues=(
                "punctuation:exclamation",
                "punctuation:question",
                "emoji:positive",
                "punctuation:ellipsis",
            ),
            has_exclamation=True,
            has_question=True,
            has_ellipsis=True,
            has_positive_emoji=True,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )

    assert segment.text == "Hello! :) ...?"
    assert segment.emotion.value == "happy"
    assert segment.intensity == 0.7
    assert segment.pause_ms == 220
    assert segment.rate == pytest.approx(1.1)
    assert segment.pitch_hint == 3.0
    assert segment.cues == [
        "punctuation:exclamation",
        "punctuation:question",
        "emoji:positive",
        "punctuation:ellipsis",
    ]


def test_plan_segment_makes_exclamation_more_audible_than_neutral() -> None:
    neutral = plan_segment(
        "Hello.",
        ExtractedSignals(
            cues=(),
            has_exclamation=False,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )
    emphatic = plan_segment(
        "Hello!",
        ExtractedSignals(
            cues=("punctuation:exclamation",),
            has_exclamation=True,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )

    assert emphatic.rate > neutral.rate
    assert emphatic.pitch_hint > neutral.pitch_hint
    assert emphatic.pause_ms == neutral.pause_ms


def test_plan_segment_keeps_ellipsis_more_subtle_than_before() -> None:
    ellipsis = plan_segment(
        "Wait...",
        ExtractedSignals(
            cues=("punctuation:ellipsis",),
            has_exclamation=False,
            has_question=False,
            has_ellipsis=True,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )

    assert ellipsis.emotion.value == "sad"
    assert ellipsis.intensity == 0.2
    assert ellipsis.pause_ms == 220
    assert ellipsis.rate == 0.96


def test_plan_segment_amplifies_repeated_exclamation_more_than_single_exclamation() -> None:
    single = plan_segment(
        "Wow!",
        ExtractedSignals(
            cues=("punctuation:exclamation",),
            has_exclamation=True,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )
    repeated = plan_segment(
        "Wow!!!",
        ExtractedSignals(
            cues=("punctuation:exclamation", "punctuation:repeated-exclamation"),
            has_exclamation=True,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=True,
            has_repeated_question=False,
        ),
    )

    assert repeated.rate > single.rate
    assert repeated.pitch_hint > single.pitch_hint


def test_plan_segment_makes_mixed_punctuation_more_expressive_than_plain_exclamation() -> None:
    plain = plan_segment(
        "Really!",
        ExtractedSignals(
            cues=("punctuation:exclamation",),
            has_exclamation=True,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )
    mixed = plan_segment(
        "Really?!",
        ExtractedSignals(
            cues=("punctuation:exclamation", "punctuation:question", "punctuation:mixed"),
            has_exclamation=True,
            has_question=True,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=True,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )

    assert mixed.rate > plain.rate
    assert mixed.pitch_hint > plain.pitch_hint
