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
            has_negative_emoji=False,
            has_angry_emoji=False,
            has_excited_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        ),
    )

    assert segment.emotion.value == "happy"
    assert segment.rate == 0.85
    assert segment.pause_ms >= 400