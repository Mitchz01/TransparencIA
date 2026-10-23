"""Spec 015's API Contract: /api/auth/* and /api/me, and the session cookie."""

from app.adapters.inbound.http.session_cookie import SESSION_COOKIE
from tests.api import PASSWORD, new_client


def _error(response, status: int, code: str) -> dict:
    assert response.status_code == status, response.text
    body = response.json()
    assert body["code"] == code and body["detail"]
    return body


def test_sign_up_sets_an_http_only_cookie_and_never_returns_the_hash(anonymous):
    response = anonymous.post("/api/auth/signup", json={"name": " Leo  Ruiz ", "email": " Leo@Team.dev ", "password": PASSWORD})
    assert response.status_code == 201
    assert response.headers["Location"] == "/api/me"
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=") and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()
    account = response.json()
    assert set(account) == {"id", "email", "name", "role", "seniority", "hours_per_week", "skills", "github_username", "avatar_url", "created_at"}
    assert (account["email"], account["name"], account["role"]) == ("leo@team.dev", "Leo Ruiz", None)
    assert PASSWORD not in response.text and "scrypt" not in response.text
    assert anonymous.get("/api/me").json() == account


def test_sign_up_422(anonymous):
    body = _error(anonymous.post("/api/auth/signup", json={"name": "", "email": "nope", "password": "short"}), 422, "validation_failed")
    assert {e["field"] for e in body["errors"]} == {"name", "email", "password"}

    anonymous.post("/api/auth/signup", json={"name": "Leo", "email": "leo@team.dev", "password": PASSWORD})
    taken = _error(new_client(anonymous).post("/api/auth/signup", json={"name": "Leo", "email": "LEO@team.dev", "password": PASSWORD}), 422, "validation_failed")
    assert taken["errors"] == [{"field": "email", "message": "Already registered."}]
    _error(anonymous.post("/api/auth/signup", json={"name": "Leo"}), 422, "validation_failed")


def test_sign_in_sign_out(anonymous):
    anonymous.post("/api/auth/signup", json={"name": "Leo", "email": "leo@team.dev", "password": PASSWORD})
    browser = new_client(anonymous)
    _error(browser.get("/api/me"), 401, "not_authenticated")

    wrong = _error(browser.post("/api/auth/signin", json={"email": "leo@team.dev", "password": "wrong-password"}), 401, "invalid_credentials")
    unknown = _error(browser.post("/api/auth/signin", json={"email": "nobody@team.dev", "password": PASSWORD}), 401, "invalid_credentials")
    assert wrong == unknown

    signed_in = browser.post("/api/auth/signin", json={"email": " LEO@team.dev", "password": PASSWORD})
    assert signed_in.status_code == 200 and signed_in.json()["email"] == "leo@team.dev"
    assert browser.get("/api/me").status_code == 200

    out = browser.post("/api/auth/signout")
    assert out.status_code == 204 and "Max-Age=0" in out.headers["set-cookie"]
    _error(browser.get("/api/me"), 401, "not_authenticated")
    assert browser.post("/api/auth/signout").status_code == 204  # idempotent
    assert anonymous.get("/api/me").status_code == 200  # the other device stays signed in


def test_a_made_up_cookie_is_rejected(anonymous):
    anonymous.cookies.set(SESSION_COOKIE, "made-up")
    _error(anonymous.get("/api/me"), 401, "not_authenticated")


def test_patch_me(client):
    response = client.patch("/api/me", json={"role": "Backend", "seniority": "senior", "hours_per_week": 30, "skills": ["Python", "python"], "github_username": "@ana"})
    assert response.status_code == 200, response.text
    me = response.json()
    assert (me["role"], me["seniority"], me["hours_per_week"], me["skills"], me["github_username"]) == ("Backend", "senior", 30, ["Python"], "ana")
    assert client.patch("/api/me", json={"role": None}).json()["role"] is None
    assert client.patch("/api/me", json={"avatar_url": "/avatars/ana-gomez.jpg"}).json()["avatar_url"] == "/avatars/ana-gomez.jpg"
    assert client.get("/api/me").json()["avatar_url"] == "/avatars/ana-gomez.jpg"

    _error(client.patch("/api/me", json={}), 422, "validation_failed")
    body = _error(client.patch("/api/me", json={"name": None, "hours_per_week": 70}), 422, "validation_failed")
    assert body["errors"] == [{"field": "name", "message": "Required."}]
    body = _error(client.patch("/api/me", json={"hours_per_week": 70, "seniority": "guru"}), 422, "validation_failed")
    assert [e["field"] for e in body["errors"]] == ["seniority"]


def test_every_api_endpoint_needs_a_session_except_the_public_ones(anonymous):
    for method, url in [
        ("get", "/api/projects"),
        ("post", "/api/projects"),
        ("get", "/api/projects/1"),
        ("get", "/api/projects/1/board"),
        ("get", "/api/projects/1/events"),
        ("patch", "/api/tasks/1"),
        ("post", "/api/proposals/1/approve"),
        ("get", "/api/documents/1"),
        ("put", "/api/members/1/github-username"),
        ("post", "/api/invitations/abc/join"),
        ("patch", "/api/me"),
    ]:
        response = getattr(anonymous, method)(url)
        assert response.status_code == 401 and response.json()["code"] == "not_authenticated", (method, url)

    assert anonymous.get("/api/health").status_code == 200
    assert anonymous.get("/api/invitations/abc").json()["code"] == "invitation_not_found"
