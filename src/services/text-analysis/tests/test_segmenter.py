from app.domain.segmenter import split_segments


def test_split_segments_returns_single_segment_for_one_sentence() -> None:
    assert split_segments("Hello! :)") == ["Hello! :)"]


def test_split_segments_returns_empty_list_for_empty_text() -> None:
    assert split_segments("") == []


def test_split_segments_splits_sentences_on_period() -> None:
    assert split_segments("Hello there. General Kenobi.") == [
        "Hello there.",
        "General Kenobi.",
    ]


def test_split_segments_splits_sentences_on_exclamation_and_question() -> None:
    assert split_segments("Hello! How are you?") == ["Hello!", "How are you?"]


def test_split_segments_splits_on_ellipsis() -> None:
    assert split_segments("Wait... What now?") == ["Wait...", "What now?"]


def test_split_segments_keeps_mixed_punctuation_together() -> None:
    assert split_segments("Really?! Next.") == ["Really?!", "Next."]


def test_split_segments_keeps_trailing_emoticon_with_segment() -> None:
    assert split_segments("Hello! :) How are you?") == ["Hello! :)", "How are you?"]


def test_split_segments_does_not_split_known_abbreviations() -> None:
    assert split_segments("Dr. Smith is here. Hello!") == [
        "Dr. Smith is here.",
        "Hello!",
    ]
