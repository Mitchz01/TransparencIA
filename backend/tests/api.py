"""Helpers for API tests since spec 015: every /api call needs a session, and a project's team
is made of accounts that join with the invitation link."""

from itertools import count
from typing import Any

from fastapi.testclient import TestClient

PASSWORD = "secret-123"
PROFILE_FIELDS = ("role", "seniority", "hours_per_week", "skills", "github_username")
_emails = count(1)


def new_client(client: TestClient) -> TestClient:
    """Another browser on the same app: its own cookies, nobody signed in."""
    return TestClient(client.app, raise_server_exceptions=False)


def sign_up(client: TestClient, name: str = "Ana", **profile: Any) -> dict[str, Any]:
    """Signs `client` up as a new account (unique email) and fills in the profile fields given."""
    email = profile.pop("email", None) or f"user{next(_emails)}@team.dev"
    response = client.post("/api/auth/signup", json={"name": name, "email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    if profile:
        response = client.patch("/api/me", json=profile)
        assert response.status_code == 200, response.text
    return response.json()


def as_new_user(client: TestClient, name: str, **profile: Any) -> TestClient:
    other = new_client(client)
    sign_up(other, name, **profile)
    return other


def invite_token(client: TestClient, project_id: int) -> str:
    response = client.get(f"/api/projects/{project_id}/invitation")
    assert response.status_code == 200, response.text
    return response.json()["token"]


def join(client: TestClient, token: str, **body: Any) -> dict[str, Any]:
    response = client.post(f"/api/invitations/{token}/join", json=body or None)
    assert response.status_code == 200, response.text
    return response.json()


def create_project(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    """Creates a project the way the old API did, from a body that may list `members`: the first
    one becomes the signed-in creator's profile (they're the leader), the others sign up in their
    own clients and join with the link. Returns the project with its whole team."""
    body = dict(body)
    members = body.pop("members", [])
    if members:
        first = members[0]
        profile = {"name": first["name"], **{k: v for k, v in first.items() if k in PROFILE_FIELDS}}
        response = client.patch("/api/me", json=profile)
        assert response.status_code == 200, response.text
    response = client.post("/api/projects", json=body)
    assert response.status_code == 201, response.text
    project = response.json()
    if len(members) > 1:
        token = invite_token(client, project["id"])
        for member in members[1:]:
            profile = {k: v for k, v in member.items() if k in PROFILE_FIELDS}
            join(as_new_user(client, member["name"], **profile), token)
        project = client.get(f"/api/projects/{project['id']}").json()
    return project
