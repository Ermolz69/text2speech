from app.domain.service import analyze_text


def test_analyze_text_builds_segments_from_domain_pipeline() -> None:
    response = analyze_text("  Hello! :)  ")

    assert len(response.segments) == 1
    segment = response.segments[0]
    assert segment.text == "Hello! :)"
    assert segment.emotion.value == "happy"
    assert segment.intensity >= 0.6


def test_analyze_text_builds_multiple_segments_in_order() -> None:
    response = analyze_text("Hello! :) How are you?")

    assert [segment.text for segment in response.segments] == ["Hello! :)", "How are you?"]
    assert response.segments[0].emotion.value == "happy"
    assert "emoji:positive" in response.segments[0].cues
    assert response.segments[1].emotion.value == "neutral"
    assert "punctuation:question" in response.segments[1].cues
