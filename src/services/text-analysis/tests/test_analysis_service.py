from app.domain.service import analyze_text


def test_analyze_text_builds_segments_from_domain_pipeline() -> None:
    response = analyze_text("  Hello! :)  ")

    assert len(response.segments) == 1
    segment = response.segments[0]
    assert segment.text == "Hello! :)"
    assert segment.emotion.value == "happy"
    assert segment.intensity >= 0.6
