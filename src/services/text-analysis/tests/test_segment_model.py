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


def test_analyze_returns_stable_segment_shape() -> None:
    response = client.post("/analyze", json={"text": "Hello! :)"})

    assert response.status_code == 200
    body = response.json()
    assert list(body.keys()) == ["segments"]
    assert len(body["segments"]) == 1

    segment = body["segments"][0]
    assert segment["text"] == "Hello! :)"
    assert segment["emotion"] == "happy"
    assert segment["intensity"] >= 0.6
    assert segment["pause_ms"] >= 0
    assert "cues" in segment


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
    assert "punctuation:exclamation" in segment["cues"]
    assert segment["emotion"] == "excited"


def test_analyze_normalizes_basic_text_noise_and_ellipsis() -> None:
    response = client.post("/analyze", json={"text": " Wait \u00A0 …  "})

    assert response.status_code == 200
    body = response.json()
    segment = body["segments"][0]

    assert segment["text"] == "Wait..."
    assert "punctuation:ellipsis" in segment["cues"]
    assert segment["pause_ms"] == 300


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