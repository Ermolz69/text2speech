from fastapi import FastAPI

from app.models.segment import AnalyzeRequest, AnalyzeResponse, Emotion, SegmentMetadata

app = FastAPI(title="Text Analysis Service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "text-analysis"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    text = payload.text.strip()

    cues: list[str] = []
    emotion = Emotion.NEUTRAL
    intensity = 0.0
    rate = 1.0
    pitch_hint = 0.0
    pause_ms = 150

    if "!" in text:
        cues.append("punctuation:exclamation")
        emotion = Emotion.EXCITED
        intensity = 0.7
        rate = 1.1
        pitch_hint = 2.0

    if "?" in text:
        cues.append("punctuation:question")
        pitch_hint = max(pitch_hint, 1.0)

    if any(emoji in text for emoji in ["😊", "😄", "😁", "🙂"]):
        cues.append("emoji:positive")
        emotion = Emotion.HAPPY
        intensity = max(intensity, 0.6)
        pitch_hint = max(pitch_hint, 1.5)

    if "..." in text:
        cues.append("punctuation:ellipsis")
        pause_ms = 300
        rate = min(rate, 0.9)

    segment = SegmentMetadata(
        text=text,
        emotion=emotion,
        intensity=intensity,
        pause_ms=pause_ms,
        rate=rate,
        pitch_hint=pitch_hint,
        cues=cues,
    )

    return AnalyzeResponse(segments=[segment])