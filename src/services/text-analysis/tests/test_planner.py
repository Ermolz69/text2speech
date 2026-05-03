import pytest

from app.domain.planner import plan_segment
from app.domain.signal_extractor import ExtractedSignals, SentenceIntent


def _default_signals(**overrides) -> ExtractedSignals:
    base = ExtractedSignals(
        cues=(),
        sentence_intent=SentenceIntent.DECLARATIVE,
        has_exclamation=False,
        has_question=False,
        has_ellipsis=False,
        has_positive_emoji=False,
        has_negative_emoji=False,
        has_surprise_emoji=False,
        has_celebration_emoji=False,
        has_mixed_punctuation=False,
        has_repeated_exclamation=False,
        has_repeated_question=False,
        is_all_caps=False,
        exclamation_count=0,
        question_count=0,
        positive_emoji_count=0,
    )
    return ExtractedSignals(**{**base.__dict__, **overrides})


def test_plan_segment_combines_emotion_and_prosody_rules() -> None:
    segment = plan_segment(
        "Hello! :) ...?",
        _default_signals(
            cues=(
                "punctuation:exclamation",
                "punctuation:question",
                "emoji:positive",
                "punctuation:ellipsis",
                "intent:interrogative",
            ),
            sentence_intent=SentenceIntent.INTERROGATIVE,
            has_exclamation=True,
            has_question=True,
            has_ellipsis=True,
            has_positive_emoji=True,
            positive_emoji_count=1,
        ),
    )

    assert segment.text == "Hello! :) ...?"
    assert segment.emotion.value == "happy"
    assert segment.intensity == 0.7
    assert segment.pause_ms == 220
    assert segment.rate == pytest.approx(1.1)
    assert segment.pitch_hint == 3.0
    assert segment.sentence_intent is SentenceIntent.INTERROGATIVE
    assert [point.model_dump() for point in segment.pitch_contour] == [
        {"position": 0.0, "shift": 0.0},
        {"position": 0.8, "shift": 0.0},
        {"position": 1.0, "shift": 0.15},
    ]
    assert segment.cues == [
        "punctuation:exclamation",
        "punctuation:question",
        "emoji:positive",
        "punctuation:ellipsis",
        "intent:interrogative",
        "hesitation:uh",
    ]


def test_plan_segment_makes_exclamation_more_audible_than_neutral() -> None:
    neutral = plan_segment(
        "Hello.",
        _default_signals(),
    )
    emphatic = plan_segment(
        "Hello!",
        _default_signals(
            cues=("punctuation:exclamation", "intent:declarative"),
            has_exclamation=True,
        ),
    )

    assert emphatic.rate > neutral.rate
    assert emphatic.pitch_hint > neutral.pitch_hint
    assert emphatic.pause_ms == neutral.pause_ms
    assert emphatic.pitch_contour[0].shift == 0.2


def test_plan_segment_keeps_ellipsis_more_subtle_than_before() -> None:
    ellipsis = plan_segment(
        "Wait...",
        _default_signals(
            cues=("punctuation:ellipsis", "intent:declarative"),
            has_ellipsis=True,
        ),
    )

    assert ellipsis.emotion.value == "sad"
    assert ellipsis.intensity == 0.2
    assert ellipsis.pause_ms == 220
    assert ellipsis.rate == 0.96
    assert ellipsis.pitch_contour[-1].shift < 0.0


def test_plan_segment_amplifies_repeated_exclamation_more_than_single_exclamation() -> None:
    single = plan_segment(
        "Wow!",
        _default_signals(
            cues=("punctuation:exclamation", "intent:declarative"),
            has_exclamation=True,
        ),
    )
    repeated = plan_segment(
        "Wow!!!",
        _default_signals(
            cues=(
                "punctuation:exclamation",
                "punctuation:repeated-exclamation",
                "intent:declarative",
            ),
            has_exclamation=True,
            has_repeated_exclamation=True,
            exclamation_count=3,
        ),
    )

    assert repeated.rate > single.rate
    assert repeated.pitch_hint > single.pitch_hint


def test_plan_segment_makes_mixed_punctuation_more_expressive_than_plain_exclamation() -> None:
    plain = plan_segment(
        "Really!",
        _default_signals(
            cues=("punctuation:exclamation", "intent:declarative"),
            has_exclamation=True,
        ),
    )
    mixed = plan_segment(
        "Really?!",
        _default_signals(
            cues=(
                "punctuation:exclamation",
                "punctuation:question",
                "punctuation:mixed",
                "intent:interrogative",
            ),
            sentence_intent=SentenceIntent.INTERROGATIVE,
            has_exclamation=True,
            has_question=True,
            has_mixed_punctuation=True,
        ),
    )

    assert mixed.rate > plain.rate
    assert mixed.pitch_hint > plain.pitch_hint
    assert mixed.pitch_contour[-1].shift == pytest.approx(0.15)


def test_plan_segment_uses_imperative_contour_for_command_like_text() -> None:
    imperative = plan_segment(
        "Please close the door.",
        _default_signals(
            cues=("intent:imperative",),
            sentence_intent=SentenceIntent.IMPERATIVE,
        ),
    )

    assert imperative.sentence_intent is SentenceIntent.IMPERATIVE
    assert [point.model_dump() for point in imperative.pitch_contour] == [
        {"position": 0.0, "shift": 0.08},
        {"position": 1.0, "shift": -0.06},
    ]


def test_plan_segment_extracts_stressed_words_from_uppercase_and_markers() -> None:
    segment = plan_segment(
        "I REALLY *need* this.",
        _default_signals(
            cues=("intent:declarative",),
        ),
    )

    assert segment.stressed_words == ["need", "REALLY"]
    assert "emphasis:need" in segment.cues
    assert "emphasis:really" in segment.cues


def test_plan_segment_adds_hesitation_marker_for_ellipsis() -> None:
    segment = plan_segment(
        "Wait... let me see",
        _default_signals(
            cues=("punctuation:ellipsis", "intent:declarative"),
            has_ellipsis=True,
        ),
    )

    assert segment.hesitation_markers == ["uh"]
    assert "hesitation:uh" in segment.cues


def test_plan_segment_adds_complexity_based_hesitation_marker() -> None:
    segment = plan_segment(
        "Well, I think, we should maybe reconsider this choice carefully.",
        _default_signals(
            cues=("intent:declarative",),
        ),
    )

    assert segment.hesitation_markers == ["um"]
