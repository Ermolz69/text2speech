from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import SegmentMetadata
from app.providers.base import SynthesisResult

client = TestClient(app, raise_server_exceptions=False)


def test_health_reports_readiness_from_provider() -> None:
    class ReadyProvider:
        def get_readiness(self) -> dict[str, object]:
            return {
                "ready": True,
                "binary_available": True,
                "ffmpeg_available": True,
                "model_configured": True,
                "model_exists": True,
            }

        def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
            return SynthesisResult(
                audio_url="/stub.wav",
                received_segments=len(segments),
                total_pause_ms=0,
            )

    app.state.synthesis_provider = ReadyProvider()

    try:
        response = client.get("/health")
        ready_response = client.get("/health/ready")
    finally:
        del app.state.synthesis_provider

    assert response.status_code == 200
    assert response.headers["x-request-id"]
    assert response.json() == {
        "status": "ok",
        "service": "tts-adapter",
        "readiness": {
            "ready": True,
            "binary_available": True,
            "ffmpeg_available": True,
            "model_configured": True,
            "model_exists": True,
        },
    }
    assert ready_response.status_code == 200
    assert ready_response.headers["x-request-id"]
    assert ready_response.json()["ready"] is True



def test_health_ready_returns_503_when_provider_is_not_ready() -> None:
    class NotReadyProvider:
        def get_readiness(self) -> dict[str, object]:
            return {
                "ready": False,
                "binary_available": True,
                "ffmpeg_available": False,
                "model_configured": True,
                "model_exists": False,
            }

        def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
            raise AssertionError("synthesize should not be called")

    app.state.synthesis_provider = NotReadyProvider()

    try:
        response = client.get("/health")
        ready_response = client.get("/health/ready")
    finally:
        del app.state.synthesis_provider

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert ready_response.status_code == 503
    assert ready_response.json()["ready"] is False



def test_synthesize_accepts_shared_request_structure() -> None:
    class StubProvider:
        def synthesize(self, segments: list[SegmentMetadata]) -> SynthesisResult:
            return SynthesisResult(
                audio_url="/stub.wav",
                received_segments=len(segments),
                total_pause_ms=sum(segment.pause_ms for segment in segments),
            )

    app.state.synthesis_provider = StubProvider()
    payload = {
        "text": "Hello! :)",
        "voiceId": "voice-1",
        "metadata": {
            "format": "wav",
            "segments": [
                {
                    "text": "Hello! :)",
                    "emotion": "joy",
                    "intensity": 2,
                    "emoji": ["positive"],
                    "punctuation": ["exclamation"],
                    "pauseAfterMs": 250,
                    "rate": 1.18,
                    "pitchHint": 3.0,
                    "hesitationMarkers": ["uh"],
                    "stressedWords": ["Hello"],
                }
            ],
        },
    }

    try:
        response = client.post(
            "/synthesize",
            json=payload,
            headers={"X-Request-Id": "req-tts-123"},
        )
    finally:
        del app.state.synthesis_provider

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req-tts-123"
    body = response.json()
    assert body == {
        "audioUrl": "/stub.wav",
        "metadata": payload["metadata"],
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
        "text": "Hello",
        "voiceId": "voice-1",
        "metadata": {
            "segments": [
                {
                    "text": "Hello",
                    "emotion": "neutral",
                    "intensity": 0,
                    "pauseAfterMs": 10,
                    "rate": 1.0,
                    "pitchHint": 0.0,
                    "hesitationMarkers": ["uh"],
                    "stressedWords": ["Hello"],
                }
            ]
        },
    }

    try:
        response = client.post("/synthesize", json=payload)
    finally:
        del app.state.synthesis_provider

    assert response.status_code == 200
    assert response.json() == {
        "audioUrl": "/stub.wav",
        "metadata": payload["metadata"],
    }
    assert len(provider.calls) == 1
    assert provider.calls[0][0].text == "Hello"
    assert provider.calls[0][0].pause_ms == 10
    assert provider.calls[0][0].intensity == 0.0



def test_synthesize_validation_errors_use_shared_envelope() -> None:
    response = client.post(
        "/synthesize",
        json={},
        headers={"X-Request-Id": "req-tts-validation"},
    )

    assert response.status_code == 422
    assert response.headers["x-request-id"] == "req-tts-validation"
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["path"] == "/synthesize"
    assert {detail["location"] for detail in body["error"]["details"]} >= {"body.text", "body.voiceId"}



def test_synthesize_rejects_missing_metadata_segments() -> None:
    response = client.post(
        "/synthesize",
        json={
            "text": "Hello",
            "voiceId": "voice-1",
            "metadata": {"format": "wav"},
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["path"] == "/synthesize"
    assert "metadata.segments are required" in body["error"]["details"][0]["message"]



def test_synthesize_runtime_errors_use_shared_envelope() -> None:
    payload = {
        "text": "Hello",
        "voiceId": "voice-1",
        "metadata": {
            "segments": [
                {
                    "text": "Hello",
                    "emotion": "neutral",
                    "intensity": 0,
                    "pauseAfterMs": 0,
                    "rate": 1.0,
                    "pitchHint": 0.0,
                }
            ]
        },
    }

    response = client.post(
        "/synthesize",
        json=payload,
        headers={"x-force-error": "1"},
    )

    assert response.status_code == 500
    assert response.headers["x-request-id"]
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
        "text": "Hello",
        "voiceId": "voice-1",
        "metadata": {
            "segments": [
                {
                    "text": "Hello",
                    "emotion": "neutral",
                    "intensity": 0,
                    "pauseAfterMs": 0,
                    "rate": 1.0,
                    "pitchHint": 0.0,
                    "unknownField": "boom",
                }
            ]
        },
    }

    response = client.post("/synthesize", json=payload)

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["path"] == "/synthesize"
    assert body["error"]["details"][0]["location"] == "body.metadata.segments.0.unknownField"
