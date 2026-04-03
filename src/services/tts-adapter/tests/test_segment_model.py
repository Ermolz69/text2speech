from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import SegmentMetadata
from app.providers.base import SynthesisResult

client = TestClient(app, raise_server_exceptions=False)


def test_synthesize_accepts_segment_structure() -> None:
    class StubProvider:
        def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
            return SynthesisResult(
                audio_url="/stub.wav",
                received_segments=len(segments),
                total_pause_ms=sum(segment.pause_ms for segment in segments),
            )

    app.state.synthesis_provider = StubProvider()
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

    try:
        response = client.post("/synthesize", json=payload)
    finally:
        del app.state.synthesis_provider

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "audio_url": "/stub.wav",
        "received_segments": 1,
        "total_pause_ms": 250,
    }


def test_synthesize_delegates_to_configured_provider() -> None:
    class StubProvider:
        def __init__(self) -> None:
            self.calls: list[list[SegmentMetadata]] = []

        def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
            self.calls.append(segments)
            return SynthesisResult(
                audio_url="/stub.wav",
                received_segments=len(segments),
                total_pause_ms=999,
            )

    provider = StubProvider()
    app.state.synthesis_provider = provider
    payload = {
        "segments": [
            {
                "text": "Hello",
                "emotion": "neutral",
                "intensity": 0.0,
                "pause_ms": 10,
                "rate": 1.0,
                "pitch_hint": 0.0,
                "cues": [],
            }
        ]
    }

    try:
        response = client.post("/synthesize", json=payload)
    finally:
        del app.state.synthesis_provider

    assert response.status_code == 200
    assert response.json() == {
        "audio_url": "/stub.wav",
        "received_segments": 1,
        "total_pause_ms": 999,
    }
    assert len(provider.calls) == 1
    assert provider.calls[0][0].text == "Hello"


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
