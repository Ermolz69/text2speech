from app.domain.signal_extractor import extract_signals


def test_extract_signals_collects_known_cues() -> None:
    signals = extract_signals("Hello! :) ...?")

    assert signals.has_exclamation is True
    assert signals.has_question is True
    assert signals.has_ellipsis is True
    assert signals.has_positive_emoji is True
    assert signals.cues == (
        "punctuation:exclamation",
        "punctuation:question",
        "emoji:positive",
        "punctuation:ellipsis",
    )
