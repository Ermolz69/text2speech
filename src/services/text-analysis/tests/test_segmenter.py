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
    assert split_segments("Dr. Smith is there. Hello!") == [
        "Dr. Smith is there.",
        "Hello!",
    ]


def test_breath_pause_injection_for_long_sentence_with_comma() -> None:
    text = "The quick brown fox jumps over the lazy dog, and then it runs across the field with great speed and enthusiasm."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]
    assert '<volume level="x-low">' in result[0]


def test_breath_pause_injection_for_long_sentence_with_conjunction() -> None:
    text = "She walked through the forest and listened to the birds singing in the trees while the sun was setting behind the mountains."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]


def test_breath_pause_not_injected_for_short_sentence() -> None:
    text = "This is a short sentence."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' not in result[0]


def test_breath_pause_injection_with_semicolon() -> None:
    text = "The conference attracted researchers from around the world; many presented groundbreaking work in artificial intelligence and machine learning."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]


def test_breath_pause_injection_with_colon() -> None:
    text = "There are several important considerations to keep in mind: first, the data must be validated; second, the results should be reproducible."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]


def test_breath_pause_injection_multiple_breaks() -> None:
    text = "The first part of the experiment was conducted in controlled conditions, and the results were promising, but further analysis revealed some anomalies that required additional investigation, so the team decided to run more tests."
    result = split_segments(text)
    assert len(result) == 1
    assert result[0].count('<break time="300ms"/>') >= 2


def test_breath_pause_injection_with_but_conjunction() -> None:
    text = "The project was initially designed to be simple and elegant, but the complexity of the requirements forced the team to adopt a more sophisticated approach that involved multiple layers of abstraction."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]


def test_breath_pause_injection_with_because_conjunction() -> None:
    text = "The results were significant and warranted further investigation because the underlying patterns suggested a fundamental shift in how we understand the data."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]


def test_breath_pause_injection_preserves_existing_punctuation() -> None:
    text = "The study, which was conducted over several years, involved thousands of participants, and the findings were published in a peer-reviewed journal."
    result = split_segments(text)
    assert len(result) == 1
    assert '<break time="300ms"/>' in result[0]
    assert text.count(",") <= result[0].count(",")


def test_breath_pause_injection_threshold_boundary() -> None:
    words_18 = " ".join([f"word{i}" for i in range(18)])
    result = split_segments(words_18 + ".")
    assert len(result) == 1
    short_text = " ".join([f"word{i}" for i in range(10)])
    result_short = split_segments(short_text + ".")
    assert '<break time="300ms"/>' not in result_short[0]


def test_breath_pause_injection_with_em_dash() -> None:
    text = "The findings were remarkable — showing a clear correlation between the variables — and prompted further research into the underlying mechanisms."
    result = split_segments(text)
    assert len(result) == 1


def test_volume_dip_precedes_breath_pause() -> None:
    text = "The quick brown fox jumps over the lazy dog, and then it runs across the field with great speed and enthusiasm."
    result = split_segments(text)
    assert len(result) == 1
    segment = result[0]
    volume_dip_pos = segment.find('<volume level="x-low">')
    breath_pos = segment.find('<break time="300ms"/>')
    assert volume_dip_pos < breath_pos
    assert segment.find("</volume>") > breath_pos
