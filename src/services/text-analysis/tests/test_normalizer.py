from app.domain.normalizer import normalize_text


def test_normalize_text_collapses_whitespace() -> None:
    assert normalize_text("  Hello \n\t world  ") == "Hello world"


def test_normalize_text_removes_space_before_punctuation() -> None:
    assert normalize_text("Hello ! How are you ?") == "Hello! How are you?"


def test_normalize_text_normalizes_unicode_ellipsis() -> None:
    assert normalize_text("Wait …") == "Wait..."


def test_normalize_text_collapses_repeated_punctuation() -> None:
    assert normalize_text("Hello!!! What??? Yes,,,") == "Hello! What? Yes,"


def test_normalize_text_removes_basic_text_noise() -> None:
    assert normalize_text("Hi\u00A0\u200Bthere") == "Hi there"