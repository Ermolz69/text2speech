from __future__ import annotations

import json
import logging
import time
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.http.contracts import SynthesizeRequestDto, SynthesizeResponseDto, to_internal_segments
from app.models.segment import SegmentMetadata
from app.providers import PiperSynthesisProvider, SynthesisProvider
from app.providers.piper import DEFAULT_AUDIO_ROUTE, resolve_audio_output_dir

app = FastAPI(title="TTS Adapter Service")
request_id_header_name = "X-Request-Id"
app.mount(
    DEFAULT_AUDIO_ROUTE,
    StaticFiles(directory=resolve_audio_output_dir(), check_dir=False),
    name="generated-audio",
)


logger = logging.getLogger("tts-adapter")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def get_request_id(request: Request) -> str:
    existing = getattr(request.state, "request_id", "")
    if isinstance(existing, str) and existing:
        return existing
    incoming = request.headers.get("x-request-id", "").strip()
    if incoming:
        return incoming
    return uuid4().hex


def build_log_payload(
    request: Request,
    *,
    event: str,
    status: int | None = None,
    duration_ms: float | None = None,
    error_code: str | None = None,
    filename: str | None = None,
    segment_count: int | None = None,
    audio_url: str | None = None,
    total_pause_ms: int | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "service": "tts-adapter",
        "request_id": get_request_id(request),
        "method": request.method,
        "path": request.url.path,
        "event": event,
    }
    if status is not None:
        payload["status"] = status
    if duration_ms is not None:
        payload["duration_ms"] = round(duration_ms, 2)
    if error_code is not None:
        payload["error_code"] = error_code
    if filename is not None:
        payload["filename"] = filename
    if segment_count is not None:
        payload["segment_count"] = segment_count
    if audio_url is not None:
        payload["audio_url"] = audio_url
    if total_pause_ms is not None:
        payload["total_pause_ms"] = total_pause_ms
    return payload


def log_event(request: Request, **kwargs: object) -> None:
    logger.info(json.dumps(build_log_payload(request, **kwargs)))


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = get_request_id(request)
    request.state.request_id = request_id
    started_at = time.perf_counter()
    log_event(request, event="request_started")

    response = await call_next(request)
    response.headers[request_id_header_name] = request_id
    log_event(
        request,
        event="request_finished",
        status=response.status_code,
        duration_ms=(time.perf_counter() - started_at) * 1000,
    )
    return response


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
    response = JSONResponse(
        status_code=422,
        content=create_api_error_response(
            code="validation_error",
            message="Request validation failed",
            status=422,
            path=request.url.path,
            details=validation_error_details(exc),
        ),
    )
    response.headers[request_id_header_name] = get_request_id(request)
    log_event(request, event="validation_error", status=422, error_code="validation_error")
    return response


@app.exception_handler(Exception)
async def handle_runtime_error(
    request: Request,
    _: Exception,
) -> JSONResponse:
    response = JSONResponse(
        status_code=500,
        content=create_api_error_response(
            code="internal_error",
            message="Internal server error",
            status=500,
            path=request.url.path,
        ),
    )
    response.headers[request_id_header_name] = get_request_id(request)
    log_event(request, event="runtime_error", status=500, error_code="internal_error")
    return response


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
    log_event(request, event="health_checked", status=200)
    return payload


@app.get("/health/ready")
def health_ready(request: Request) -> JSONResponse:
    provider = get_synthesis_provider(request)
    readiness = get_provider_readiness(provider)
    ready = bool(readiness and readiness.get("ready"))

    response = JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ok" if ready else "degraded",
            "service": "tts-adapter",
            "ready": ready,
            "readiness": readiness or {"ready": False},
        },
    )
    response.headers[request_id_header_name] = get_request_id(request)
    log_event(
        request,
        event="readiness_checked",
        status=response.status_code,
        error_code=None if ready else "service_not_ready",
    )
    return response


@app.post("/synthesize", response_model=SynthesizeResponseDto, response_model_exclude_none=True)
def synthesize(payload: SynthesizeRequestDto, request: Request) -> SynthesizeResponseDto:
    if request.headers.get("x-force-error") == "1":
        raise RuntimeError("Forced test runtime error")

    segments: list[SegmentMetadata] = to_internal_segments(payload)
    result = get_synthesis_provider(request).synthesize(segments)
    filename = result.audio_url.rsplit("/", 1)[-1] if "/" in result.audio_url else result.audio_url
    log_event(
        request,
        event="synthesize_completed",
        status=200,
        segment_count=len(segments),
        audio_url=result.audio_url,
        filename=filename,
        total_pause_ms=result.total_pause_ms,
    )

    return SynthesizeResponseDto(
        audioUrl=result.audio_url,
        metadata=payload.metadata,
    )
