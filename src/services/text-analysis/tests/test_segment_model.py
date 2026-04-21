from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import SegmentMetadata

client = TestClient(app, raise_server_exceptions=False)


def test_segment_model_validates_blank_text() -> None:
    try:
        SegmentMetadata(text=" ", cues=[])
    except Exception as exc:
        assert "text must not be blank" in str(exc)
    else:
        raise AssertionError("Expected validation error")


def test_analyze_returns_shared_segment_shape() -> None:
    response = client.post("/analyze", json={"text": "Hello! :)"})

    assert response.status_code == 200
    body = response.json()
    assert list(body.keys()) == ["segments"]
    assert len(body["segments"]) == 1

    segment = body["segments"][0]
    assert segment == {
        "text": "Hello! :)",
        "emotion": "joy",
        "intensity": 2,
        "emoji": ["positive"],
        "punctuation": ["exclamation"],
        "pauseAfterMs": 150,
        "rate": 1.18,
        "pitchHint": 3.0,
        "sentenceIntent": "declarative",
        "pitchContour": [
            {"position": 0.0, "shift": 0.2},
            {"position": 0.35, "shift": 0.05},
            {"position": 1.0, "shift": -0.08},
        ],
    }


def test_analyze_normalizes_spaces_before_analysis() -> None:
    response = client.post("/analyze", json={"text": "  Hello \n\t world  "})

    assert response.status_code == 200
    body = response.json()
    assert body["segments"][0]["text"] == "Hello world"


def test_analyze_normalizes_repeated_punctuation_before_analysis() -> None:
    response = client.post("/analyze", json={"text": "Hello!!!"})

    assert response.status_code == 200
    body = response.json()
    segment = body["segments"][0]

    assert segment["text"] == "Hello!"
    assert segment["punctuation"] == ["exclamation"]
    assert segment["emotion"] == "neutral"
    assert segment["intensity"] == 0


def test_analyze_normalizes_basic_text_noise_and_ellipsis() -> None:
    response = client.post("/analyze", json={"text": " Wait \u00A0 \u2026  "})

    assert response.status_code == 200
    body = response.json()
    segment = body["segments"][0]

    assert segment == {
        "text": "Wait...",
        "emotion": "sadness",
        "intensity": 0,
        "punctuation": ["ellipsis"],
        "pauseAfterMs": 220,
        "rate": 0.96,
        "pitchHint": 0.0,
        "sentenceIntent": "declarative",
        "pitchContour": [
            {"position": 0.0, "shift": 0.04},
            {"position": 1.0, "shift": -0.1},
        ],
        "hesitationMarkers": ["uh"],
    }


def test_analyze_returns_multiple_segments_with_independent_metadata() -> None:
    response = client.post("/analyze", json={"text": "Hello! :) How are you?"})

    assert response.status_code == 200
    body = response.json()
    assert [segment["text"] for segment in body["segments"]] == ["Hello! :)", "How are you?"]
    assert body["segments"][0]["emotion"] == "joy"
    assert body["segments"][0]["emoji"] == ["positive"]
    assert body["segments"][1]["emotion"] == "neutral"
    assert body["segments"][1]["intensity"] == 0
    assert body["segments"][1]["punctuation"] == ["question"]
    assert body["segments"][1]["sentenceIntent"] == "interrogative"
    assert body["segments"][1]["pitchContour"][-1] == {"position": 1.0, "shift": 0.15}


def test_analyze_exposes_mixed_punctuation_in_shared_segment_metadata() -> None:
    response = client.post("/analyze", json={"text": "Really?!"})

    assert response.status_code == 200
    body = response.json()
    segment = body["segments"][0]

    assert segment["text"] == "Really?!"
    assert segment["punctuation"] == ["exclamation", "question", "mixed"]
    assert segment["emotion"] == "neutral"
    assert segment["intensity"] == 0
    assert segment["sentenceIntent"] == "interrogative"
    assert segment["pitchContour"][-1]["shift"] == 0.15


def test_analyze_exposes_stressed_words_for_uppercase_and_marked_tokens() -> None:
    response = client.post("/analyze", json={"text": "I REALLY *love* this"})

    assert response.status_code == 200
    body = response.json()
    segment = body["segments"][0]

    assert segment["stressedWords"] == ["love", "REALLY"]


def test_analyze_exposes_hesitation_markers_for_ellipsis() -> None:
    response = client.post("/analyze", json={"text": "Wait... let me see"})

    assert response.status_code == 200
    body = response.json()
    segment = body["segments"][0]

    assert segment["hesitationMarkers"] == ["uh"]


def test_analyze_splits_normalized_repeated_punctuation_into_multiple_segments() -> None:
    response = client.post("/analyze", json={"text": "Hello!!! What???"})

    assert response.status_code == 200
    body = response.json()
    assert [segment["text"] for segment in body["segments"]] == ["Hello!", "What?"]
    assert body["segments"][0]["emotion"] == "neutral"
    assert body["segments"][0]["intensity"] == 0
    assert body["segments"][1]["punctuation"] == ["question"]
    assert body["segments"][1]["emotion"] == "neutral"


def test_analyze_validation_errors_use_shared_envelope() -> None:
    response = client.post("/analyze", json={})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Request validation failed",
            "status": 422,
            "path": "/analyze",
            "details": [
                {
                    "location": "body.text",
                    "message": "Field required",
                    "code": "missing",
                }
            ],
        }
    }


def test_analyze_rejects_blank_text_after_normalization() -> None:
    response = client.post("/analyze", json={"text": " \n\t "})

    assert response.status_code == 422
    body = response.json()

    assert body["error"]["code"] == "validation_error"
    assert body["error"]["path"] == "/analyze"
    assert body["error"]["details"][0]["location"] == "body.text"
    assert "text must not be blank" in body["error"]["details"][0]["message"]


def test_analyze_runtime_errors_use_shared_envelope() -> None:
    response = client.post(
        "/analyze",
        json={"text": "Hello"},
        headers={"x-force-error": "1"},
    )

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Internal server error",
            "status": 500,
            "path": "/analyze",
        }
    }

