"""Shared conventions (plan/api-conventions.md): X-Request-Id and the 500 body."""

from fastapi import APIRouter


def test_request_id_is_echoed_or_generated(client):
    echoed = client.get("/api/health", headers={"X-Request-Id": "abc-123"})
    assert echoed.headers["X-Request-Id"] == "abc-123"
    generated = client.get("/api/projects/9999")
    assert generated.headers["X-Request-Id"] and generated.status_code == 404


def test_unexpected_errors_are_500_without_internals(client):
    from app.main import app

    router = APIRouter()

    @router.get("/api/_boom")
    def boom():
        raise RuntimeError("secret SQL here")

    app.include_router(router)
    try:
        response = client.get("/api/_boom", headers={"X-Request-Id": "req-500"})
    finally:
        app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") != "/api/_boom"]
    assert response.status_code == 500
    assert response.json() == {"code": "internal_error", "detail": "Something went wrong."}
    assert response.headers["X-Request-Id"] == "req-500"
