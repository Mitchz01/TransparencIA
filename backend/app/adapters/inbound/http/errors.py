"""Shared HTTP conventions (plan/api-conventions.md): one error body for the whole API,
the status per error, 400/422/500 handlers and the X-Request-Id header."""

import re
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import logger
from app.domain.errors import (
    CapacityNotApplicable,
    DomainError,
    InvalidDiagram,
    MethodologyLocked,
    NotFound,
    PlanningAlreadyRunning,
    PlanningNotStartable,
    ProposalAlreadyResolved,
    ProposalNotRetryable,
    RegenerationInProgress,
    StageNotRetryable,
    ValidationFailed,
    VersionConflict,
)

REQUEST_ID_HEADER = "X-Request-Id"

# Anything not listed here and not a NotFound/ValidationFailed is a state conflict (409).
_STATUS: dict[type[DomainError], int] = {
    ValidationFailed: 422,
    MethodologyLocked: 409,
    ProposalAlreadyResolved: 409,
    ProposalNotRetryable: 409,
    CapacityNotApplicable: 409,
    PlanningAlreadyRunning: 409,
    PlanningNotStartable: 409,
    StageNotRetryable: 409,
    InvalidDiagram: 422,
    RegenerationInProgress: 409,
    VersionConflict: 409,
}


def status_for(error: DomainError) -> int:
    if isinstance(error, NotFound):
        return 404
    for cls, status in _STATUS.items():
        if isinstance(error, cls):
            return status
    return 409


def error_body(code: str, detail: str, errors: list[dict[str, str]] | None = None, **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "detail": detail, **extra}
    if errors is not None:
        body["errors"] = errors
    return body


def domain_error_body(error: DomainError) -> dict[str, Any]:
    errors = None
    if isinstance(error, ValidationFailed):
        errors = [{"field": e.field, "message": e.message} for e in error.errors]
    return error_body(error.code, error.detail, errors, **error.extra())


# ---------- Request validation (FastAPI / Pydantic) ----------

_LITERAL_EXPECTED = re.compile(r"'([^']*)'")


def field_path(loc: tuple[Any, ...]) -> str:
    """('body', 'members', 1, 'name') -> 'members[1].name'; ('query', 'status') -> 'status'."""
    parts = list(loc[1:]) if loc and loc[0] in ("body", "query", "path", "header") else list(loc)
    path = ""
    for part in parts:
        if isinstance(part, int):
            path += f"[{part}]"
        else:
            path += f".{part}" if path else str(part)
    return path


def field_message(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    if kind == "missing":
        return "Required."
    if kind == "literal_error":
        options = _LITERAL_EXPECTED.findall(str(error.get("ctx", {}).get("expected", "")))
        if options:
            return f"Must be one of: {', '.join(options)}."
    message = str(error.get("msg", "Invalid value."))
    return message if message.endswith(".") else message + "."


def _is_malformed(errors: list[dict[str, Any]]) -> bool:
    return any(e.get("type") in ("json_invalid", "model_attributes_type") and e.get("loc", ())[:1] == ("body",) for e in errors)


# ---------- X-Request-Id and Content-Type (pure ASGI, so SSE streams aren't buffered) ----------


class RequestContextMiddleware:
    """Reads or creates X-Request-Id, echoes it on every response, and rejects bodies
    that aren't JSON with 400 malformed_request."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        request_id = headers.get("x-request-id") or str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                message["headers"].append((REQUEST_ID_HEADER.encode(), request_id.encode()))
            await send(message)

        has_body = scope["method"] in ("POST", "PUT", "PATCH") and int(headers.get("content-length", "0") or 0) > 0
        content_type = headers.get("content-type", "")
        if has_body and not content_type.startswith("application/json"):
            response = JSONResponse(
                status_code=400,
                content=error_body("malformed_request", "The body must be JSON (Content-Type: application/json)."),
            )
            await response(scope, receive, send_with_id)
            return

        await self.app(scope, receive, send_with_id)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "") or str(uuid.uuid4())


def register_error_handlers(app: FastAPI) -> None:
    app.add_middleware(RequestContextMiddleware)

    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(status_code=status_for(error), content=domain_error_body(error))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        errors = list(error.errors())
        if _is_malformed(errors):
            return JSONResponse(status_code=400, content=error_body("malformed_request", "The body isn't valid JSON."))
        fields = [{"field": field_path(tuple(e.get("loc", ()))), "message": field_message(e)} for e in errors]
        return JSONResponse(
            status_code=422,
            content=error_body("validation_failed", "The request has invalid fields.", fields),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, error: Exception) -> JSONResponse:
        request_id = _request_id(request)
        logger.exception("Unhandled error (request_id=%s)", request_id, exc_info=error)
        # ServerErrorMiddleware sits outside RequestContextMiddleware, so the header is set here.
        return JSONResponse(
            status_code=500,
            content=error_body("internal_error", "Something went wrong."),
            headers={REQUEST_ID_HEADER: request_id},
        )
