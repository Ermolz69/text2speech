from app.domain.mapper import map_emotion
from app.domain.signal_extractor import ExtractedSignals
from app.models.segment import Emotion


def test_map_emotion_prefers_positive_emoji_over_exclamation() -> None:
    mapping = map_emotion(
        ExtractedSignals(
            cues=("punctuation:exclamation", "emoji:positive"),
            has_exclamation=True,
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
