from app.domain.normalizer import normalize_text


def test_normalize_text_trims_whitespace() -> None:
    assert normalize_text("  Hello! :)  ") == "Hello! :)"
