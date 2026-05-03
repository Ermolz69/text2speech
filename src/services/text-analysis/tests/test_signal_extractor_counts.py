from app.domain.signal_extractor import extract_signals


def test_extract_signals_counts_multiple_exclamations() -> None:
    signals = extract_signals("Wow!!! Amazing!!!")

    assert signals.exclamation_count == 6
    assert signals.has_repeated_exclamation is True


def test_extract_signals_counts_multiple_emojis() -> None:
    SMILING_FACE = "\U0001F60A"
    GRINNING_FACE = "\U0001F604"
    signals = extract_signals(f"Happy {SMILING_FACE} and excited {GRINNING_FACE}")

    assert signals.positive_emoji_count == 2
    assert signals.has_positive_emoji is True
