from app.domain.mapper import map_emotion
from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import Emotion


def test_map_emotion_defaults_to_neutral_without_cues() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=(),
            has_exclamation=False,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        )
    )

    assert mapping.emotion is Emotion.NEUTRAL
    assert mapping.intensity == 0.0


def test_map_emotion_returns_happy_for_positive_emoji() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=("emoji:positive",),
            has_exclamation=False,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=True,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        )
    )

    assert mapping.emotion is Emotion.HAPPY
    assert mapping.intensity == 0.7


def test_map_emotion_returns_sad_for_ellipsis() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=("punctuation:ellipsis",),
            has_exclamation=False,
            has_question=False,
            has_ellipsis=True,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        )
    )

    assert mapping.emotion is Emotion.SAD
    assert mapping.intensity == 0.2



def test_map_emotion_prefers_happy_over_sad_when_both_signals_exist() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=("emoji:positive", "punctuation:ellipsis"),
            has_exclamation=False,
            has_question=False,
            has_ellipsis=True,
            has_positive_emoji=True,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
        )
    )

    assert mapping.emotion is Emotion.HAPPY
    assert mapping.intensity == 0.7
