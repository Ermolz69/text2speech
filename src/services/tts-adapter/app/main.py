from fastapi import FastAPI

from app.models.segment import SynthesizeRequest

app = FastAPI(title="TTS Adapter Service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "tts-adapter"}


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest) -> dict:
    total_pause_ms = sum(segment.pause_ms for segment in payload.segments)

    return {
        "audio_url": "/placeholder.wav",
        "received_segments": len(payload.segments),
        "total_pause_ms": total_pause_ms,
    }