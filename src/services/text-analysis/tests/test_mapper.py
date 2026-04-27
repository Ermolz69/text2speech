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
            exclamation_count=0,
            positive_emoji_count=0,
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
            exclamation_count=0,
            positive_emoji_count=1,
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
            exclamation_count=0,
            positive_emoji_count=0,
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
            exclamation_count=0,
            positive_emoji_count=1,
        )
    )

    assert mapping.emotion is Emotion.HAPPY
    assert mapping.intensity == 0.7


def test_map_emotion_scales_intensity_with_exclamation_count() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=("punctuation:exclamation",),
            has_exclamation=True,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=False,
            has_repeated_question=False,
            exclamation_count=1,
            positive_emoji_count=0,
        )
    )

    assert mapping.emotion is Emotion.EXCITED
    assert mapping.intensity == 0.5


def test_map_emotion_scales_intensity_with_three_exclamations() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=("punctuation:exclamation", "punctuation:repeated-exclamation"),
            has_exclamation=True,
            has_question=False,
            has_ellipsis=False,
            has_positive_emoji=False,
            has_mixed_punctuation=False,
            has_repeated_exclamation=True,
            has_repeated_question=False,
            exclamation_count=3,
            positive_emoji_count=0,
        )
    )

    assert mapping.emotion is Emotion.EXCITED
    assert mapping.intensity == 1.0


def test_map_emotion_scales_intensity_with_multiple_emojis() -> None:
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
            exclamation_count=0,
            positive_emoji_count=3,
        )
    )

    assert mapping.emotion is Emotion.HAPPY
    assert mapping.intensity == 1.0

