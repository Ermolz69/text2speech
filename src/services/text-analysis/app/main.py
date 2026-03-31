from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.models.segment import AnalyzeRequest, AnalyzeResponse, Emotion, SegmentMetadata

app = FastAPI(title="Text Analysis Service")


def create_api_error_response(
    *,
    code: str,
    message: str,
    status: int,
    path: str,
    details: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "status": status,
            "path": path,
        }
    }
    if details:
        payload["error"]["details"] = details
    return payload


def validation_error_details(
    exc: RequestValidationError,
) -> list[dict[str, str]]:
    details: list[dict[str, str]] = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"])
        details.append(
            {
                "location": location,
                "message": error["msg"],
                "code": error["type"].split(".")[-1],
            }
        )
    return details


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=create_api_error_response(
            code="validation_error",
            message="Request validation failed",
            status=422,
            path=request.url.path,
            details=validation_error_details(exc),
        ),
    )


@app.exception_handler(Exception)
async def handle_runtime_error(
    request: Request,
    _: Exception,
) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=create_api_error_response(
            code="internal_error",
            message="Internal server error",
            status=500,
            path=request.url.path,
        ),
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "text-analysis"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    if request.headers.get("x-force-error") == "1":
        raise RuntimeError("Forced test runtime error")

    text = payload.text

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

    if any(emoji in text for emoji in [":)", ":D", "=)", "^^"]):
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
