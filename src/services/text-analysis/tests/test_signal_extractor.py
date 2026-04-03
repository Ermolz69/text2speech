from app.domain.signal_extractor import extract_signals


def test_extract_signals_collects_known_cues() -> None:
    signals = extract_signals("Hello! :) ...?")

    assert signals.has_exclamation is True
    assert signals.has_question is True
    assert signals.has_ellipsis is True
    assert signals.has_positive_emoji is True
    assert signals.has_mixed_punctuation is False
    assert signals.has_repeated_exclamation is False
    assert signals.has_repeated_question is False
    assert signals.cues == (
        "punctuation:exclamation",
        "punctuation:question",
        "emoji:positive",
        "punctuation:ellipsis",
    )


def test_extract_signals_recognizes_mixed_punctuation() -> None:
    signals = extract_signals("Really?!")

    assert signals.has_exclamation is True
    assert signals.has_question is True
    assert signals.has_mixed_punctuation is True
    assert signals.cues == (
        "punctuation:exclamation",
        "punctuation:question",
        "punctuation:mixed",
    )



def test_extract_signals_recognizes_inverse_mixed_punctuation() -> None:
    signals = extract_signals("Really!?")

    assert signals.has_exclamation is True
    assert signals.has_question is True
    assert signals.has_mixed_punctuation is True
    assert signals.cues == (
        "punctuation:exclamation",
        "punctuation:question",
        "punctuation:mixed",
    )


def test_extract_signals_recognizes_repeated_exclamation() -> None:
    signals = extract_signals("Wow!!!")

    assert signals.has_exclamation is True
    assert signals.has_repeated_exclamation is True
    assert signals.cues == (
        "punctuation:exclamation",
        "punctuation:repeated-exclamation",
    )


def test_extract_signals_recognizes_repeated_question() -> None:
    signals = extract_signals("What???")

    assert signals.has_question is True
    assert signals.has_repeated_question is True
    assert signals.cues == (
        "punctuation:question",
        "punctuation:repeated-question",
    )
