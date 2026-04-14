from __future__ import annotations

from typing import Any

from fastapi.exceptions import RequestValidationError


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
