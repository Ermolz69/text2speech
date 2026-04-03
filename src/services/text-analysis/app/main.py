from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain import analyze_text
from app.http.errors import create_api_error_response, validation_error_details
from app.models.segment import AnalyzeRequest, AnalyzeResponse

app = FastAPI(title="Text Analysis Service")


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

    return analyze_text(payload.text)
