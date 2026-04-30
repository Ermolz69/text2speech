from app.domain.mapper import map_emotion
from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import Emotion


def _signals(**kwargs) -> ExtractedSignals:
    defaults = dict(
        cues=(),
        has_exclamation=False,
        has_question=False,
        has_ellipsis=False,
        has_positive_emoji=False,
        has_negative_emoji=False,
        has_angry_emoji=False,
        has_excited_emoji=False,
        has_mixed_punctuation=False,
        has_repeated_exclamation=False,
        has_repeated_question=False,
    )
    defaults.update(kwargs)
    return ExtractedSignals(**defaults)


def test_map_emotion_defaults_to_neutral_without_cues() -> None:
    mapping = map_emotion(_signals())
    assert mapping.emotion is Emotion.NEUTRAL
    assert mapping.intensity == 0.0


def test_map_emotion_returns_happy_for_positive_emoji() -> None:
    mapping = map_emotion(_signals(cues=("emoji:positive",), has_positive_emoji=True))
    assert mapping.emotion is Emotion.HAPPY
    assert mapping.intensity == 0.7


def test_map_emotion_returns_sad_for_ellipsis() -> None:
    mapping = map_emotion(_signals(cues=("punctuation:ellipsis",), has_ellipsis=True))
    assert mapping.emotion is Emotion.SAD
    assert mapping.intensity == 0.4


def test_map_emotion_prefers_happy_over_sad_when_both_signals_exist() -> None:
    mapping = map_emotion(_signals(
        cues=("emoji:positive", "punctuation:ellipsis"),
        has_ellipsis=True,
        has_positive_emoji=True,
    ))
    assert mapping.emotion is Emotion.HAPPY
    assert mapping.intensity == 0.7


def test_map_emotion_returns_angry_for_angry_emoji() -> None:
    mapping = map_emotion(_signals(cues=("emoji:angry",), has_angry_emoji=True))
    assert mapping.emotion is Emotion.ANGRY
    assert mapping.intensity == 0.9


def test_map_emotion_returns_sad_for_negative_emoji() -> None:
    mapping = map_emotion(_signals(cues=("emoji:negative",), has_negative_emoji=True))
    assert mapping.emotion is Emotion.SAD
    assert mapping.intensity == 0.7


def test_map_emotion_returns_excited_for_excited_emoji() -> None:
    mapping = map_emotion(_signals(cues=("emoji:excited",), has_excited_emoji=True))
    assert mapping.emotion is Emotion.EXCITED
    assert mapping.intensity == 0.8


def test_map_emotion_angry_has_priority_over_negative() -> None:
    mapping = map_emotion(_signals(has_angry_emoji=True, has_negative_emoji=True))
    assert mapping.emotion is Emotion.ANGRY