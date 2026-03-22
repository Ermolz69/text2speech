from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_synthesize_accepts_segment_structure():
    payload = {
        "segments": [
            {
                "text": "Hello! 😊",
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


def test_synthesize_rejects_unknown_fields():
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