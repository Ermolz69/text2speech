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
    assert segment.pause_ms == 300
    assert segment.rate == 0.9
    assert segment.pitch_hint == 2.0
    assert segment.cues == [
        "punctuation:exclamation",
        "punctuation:question",
        "emoji:positive",
        "punctuation:ellipsis",
    ]
