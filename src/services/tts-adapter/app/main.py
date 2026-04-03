from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.models.segment import SynthesizeRequest
from app.providers import PiperSynthesisProvider, SynthesisProvider
from app.providers.piper import DEFAULT_AUDIO_ROUTE, resolve_audio_output_dir

app = FastAPI(title="TTS Adapter Service")
app.mount(
    DEFAULT_AUDIO_ROUTE,
    StaticFiles(directory=resolve_audio_output_dir(), check_dir=False),
    name="generated-audio",
)


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


def get_synthesis_provider(request: Request) -> SynthesisProvider:
    provider = getattr(request.app.state, "synthesis_provider", None)
    if provider is None:
        provider = PiperSynthesisProvider()
        request.app.state.synthesis_provider = provider
    return provider


def get_provider_readiness(provider: SynthesisProvider) -> dict[str, Any] | None:
    readiness_getter = getattr(provider, "get_readiness", None)
    if callable(readiness_getter):
        readiness = readiness_getter()
        if isinstance(readiness, dict):
            return readiness
    return None


@app.get("/health")
def health(request: Request) -> dict[str, Any]:
    provider = get_synthesis_provider(request)
    readiness = get_provider_readiness(provider)
    ready = readiness.get("ready") if readiness else None

    payload: dict[str, Any] = {
        "status": "ok" if ready is not False else "degraded",
        "service": "tts-adapter",
    }
    if readiness is not None:
        payload["readiness"] = readiness
    return payload


@app.get("/health/ready")
def health_ready(request: Request) -> JSONResponse:
    provider = get_synthesis_provider(request)
    readiness = get_provider_readiness(provider)
    ready = bool(readiness and readiness.get("ready"))

    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ok" if ready else "degraded",
            "service": "tts-adapter",
            "ready": ready,
            "readiness": readiness or {"ready": False},
        },
    )


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest, request: Request) -> dict:
    if request.headers.get("x-force-error") == "1":
        raise RuntimeError("Forced test runtime error")

    result = get_synthesis_provider(request).synthesize(payload.segments)

    return {
        "audio_url": result.audio_url,
        "received_segments": result.received_segments,
        "total_pause_ms": result.total_pause_ms,
    }
