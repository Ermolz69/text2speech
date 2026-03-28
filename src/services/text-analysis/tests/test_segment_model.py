from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import SegmentMetadata

client = TestClient(app)


def test_segment_model_validates_blank_text() -> None:
    try:
        SegmentMetadata(text="   ", cues=[])
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
