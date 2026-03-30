from app.domain.segmenter import split_segments


def test_split_segments_returns_single_segment_for_current_pipeline() -> None:
    assert split_segments("Hello! :)") == ["Hello! :)"]


def test_split_segments_returns_empty_list_for_empty_text() -> None:
    assert split_segments("") == []
