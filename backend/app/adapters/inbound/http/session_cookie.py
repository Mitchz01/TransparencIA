"""The session cookie (spec 015): HttpOnly so scripts can't read it, SameSite=Lax so other sites
can't send it with a POST, Secure on HTTPS deployments."""

from fastapi import Request, Response

from app.config import COOKIE_SECURE
from app.domain.accounts import SESSION_DAYS

SESSION_COOKIE = "agile_session"


def read_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE) or None


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=COOKIE_SECURE)
