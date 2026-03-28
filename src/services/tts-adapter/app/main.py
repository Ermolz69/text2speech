from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.models.segment import SynthesizeRequest

app = FastAPI(title="TTS Adapter Service")


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
    return {"status": "ok", "service": "tts-adapter"}


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest, request: Request) -> dict:
    if request.headers.get("x-force-error") == "1":
        raise RuntimeError("Forced test runtime error")

    total_pause_ms = sum(segment.pause_ms for segment in payload.segments)

    return {
        "audio_url": "/placeholder.wav",
        "received_segments": len(payload.segments),
        "total_pause_ms": total_pause_ms,
    }
