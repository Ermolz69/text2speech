from fastapi import FastAPI

app = FastAPI(title="TTS Adapter Service")


@app.get("/health")
def health() -> dict:
  return {"status": "ok", "service": "tts-adapter"}


@app.post("/synthesize")
def synthesize() -> dict:
  # Stub endpoint for MVP scaffold
  return {"audio_url": "/placeholder.wav"}

