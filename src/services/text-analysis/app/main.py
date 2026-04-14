from __future__ import annotations

import json
import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain import analyze_text
from app.http.contracts import AnalyzeRequestDto, AnalyzeResponseDto, to_analyze_response_dto
from app.http.errors import create_api_error_response, validation_error_details

app = FastAPI(title="Text Analysis Service")
request_id_header_name = "X-Request-Id"


logger = logging.getLogger("text-analysis")
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
    segment_count: int | None = None,
    text_length: int | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "service": "text-analysis",
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
    if segment_count is not None:
        payload["segment_count"] = segment_count
    if text_length is not None:
        payload["text_length"] = text_length
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


@app.get("/health")
def health(request: Request) -> dict:
    log_event(request, event="health_checked", status=200)
    return {"status": "ok", "service": "text-analysis"}


@app.post("/analyze", response_model=AnalyzeResponseDto, response_model_exclude_none=True)
def analyze(payload: AnalyzeRequestDto, request: Request) -> AnalyzeResponseDto:
    if request.headers.get("x-force-error") == "1":
        raise RuntimeError("Forced test runtime error")

    response = to_analyze_response_dto(analyze_text(payload.text))
    log_event(
        request,
        event="analyze_completed",
        status=200,
        text_length=len(payload.text),
        segment_count=len(response.segments),
    )
    return response
