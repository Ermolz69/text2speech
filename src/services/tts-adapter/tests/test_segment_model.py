from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_synthesize_accepts_segment_structure() -> None:
    payload = {
        "segments": [
            {
                "text": "Hello! :)",
                "emotion": "happy",
                "intensity": 0.8,
                "pause_ms": 250,
                "rate": 1.1,
                "pitch_hint": 2.0,
                "cues": ["emoji:positive", "punctuation:exclamation"],
            }
        ]
    }

    response = client.post("/synthesize", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["received_segments"] == 1
    assert body["total_pause_ms"] == 250


def test_synthesize_validation_errors_use_shared_envelope() -> None:
    response = client.post("/synthesize", json={})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Request validation failed",
            "status": 422,
            "path": "/synthesize",
            "details": [
                {
                    "location": "body.segments",
                    "message": "Field required",
                    "code": "missing",
                }
            ],
        }
    }


def test_synthesize_runtime_errors_use_shared_envelope() -> None:
    payload = {
        "segments": [
            {
                "text": "Hello",
                "emotion": "neutral",
                "intensity": 0.0,
                "pause_ms": 0,
                "rate": 1.0,
                "pitch_hint": 0.0,
                "cues": [],
            }
        ]
    }

    response = client.post(
        "/synthesize",
        json=payload,
        headers={"x-force-error": "1"},
    )

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Internal server error",
            "status": 500,
            "path": "/synthesize",
        }
    }


def test_synthesize_rejects_unknown_fields_with_shared_envelope() -> None:
    payload = {
        "segments": [
            {
                "text": "Hello",
                "emotion": "neutral",
                "intensity": 0.0,
                "pause_ms": 0,
                "rate": 1.0,
                "pitch_hint": 0.0,
                "cues": [],
                "unknown_field": "boom",
            }
        ]
    }

    response = client.post("/synthesize", json=payload)

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["path"] == "/synthesize"
    assert body["error"]["details"][0]["location"] == "body.segments.0.unknown_field"
