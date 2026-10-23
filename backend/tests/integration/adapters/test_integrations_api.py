"""Every status row of spec 007's API Contract (repository, issues, GitHub usernames)."""

import pytest

from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.domain.errors import CodeHostUnavailable
from app.domain.integrations import RepoAccess

PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "Frontend"}],
}


@pytest.fixture
def github(client) -> FakeCodeHost:
    """Every project gets this FakeCodeHost, whatever its token."""
    host = FakeCodeHost()
    client.app.state.code_host_factory = lambda token: host
    return host


def _project(client) -> dict:
    return client.post("/api/projects", json=PROJECT).json()


def _connect(client, pid: int, **body):
    return client.put(f"/api/projects/{pid}/repository", json={"repository": "acme/agile-app", **body})


# ---------- PUT /api/projects/{id}/repository ----------


def test_connect_200_returns_the_connection_and_never_the_token(client, github):
    pid = _project(client)["id"]
    response = _connect(client, pid, token="github_pat_secret")
    assert response.status_code == 200
    assert response.json() == {
        "repository": "acme/agile-app",
        "has_token": True,
        "mode": "test",
        "webhook_registered": False,  # no PUBLIC_BASE_URL in tests
        "replaced": None,
    }
    project = client.get(f"/api/projects/{pid}").json()
    assert project["repository"] == "acme/agile-app" and project["has_token"] is True
    assert "github_token" not in project and "webhook_id" not in project
    assert "github_pat_secret" not in client.get(f"/api/projects/{pid}").text
    assert all(member["github_username"] is None for member in project["members"])
    assert "github_pat_secret" not in client.get(f"/api/projects/{pid}/activity").text

    replaced = _connect(client, pid, repository="acme/other")
    assert replaced.status_code == 200
    assert replaced.json()["replaced"] == "acme/agile-app" and replaced.json()["has_token"] is True

    deleted = _connect(client, pid, repository="acme/other", token="")
    assert deleted.json()["has_token"] is False and deleted.json()["replaced"] is None


def test_connect_400_when_the_body_isnt_json(client, github):
    pid = _project(client)["id"]
    response = client.put(f"/api/projects/{pid}/repository", content="nope", headers={"Content-Type": "application/json"})
    assert response.status_code == 400 and response.json()["code"] == "malformed_request"
    response = client.put(f"/api/projects/{pid}/repository", content="repository=x", headers={"Content-Type": "text/plain"})
    assert response.status_code == 400 and response.json()["code"] == "malformed_request"


def test_connect_404_unknown_project(client, github):
    response = _connect(client, 999)
    assert response.status_code == 404 and response.json()["code"] == "project_not_found"


def test_connect_422_invalid_repository(client, github):
    pid = _project(client)["id"]
    for bad in ("acme", "acme/app/extra", "ac me/app", "-" * 40 + "/app"):
        response = _connect(client, pid, repository=bad)
        assert response.status_code == 422, bad
        assert response.json()["code"] == "validation_failed"
        assert response.json()["errors"][0]["field"] == "repository"
    missing = client.put(f"/api/projects/{pid}/repository", json={})
    assert missing.status_code == 422 and missing.json()["errors"] == [{"field": "repository", "message": "Required."}]
    assert github.calls == []


@pytest.mark.parametrize(
    ("access", "reason"),
    [
        (RepoAccess(status="not_found"), "not_found"),
        (RepoAccess(status="forbidden"), "forbidden"),
        (RepoAccess(status="ok", can_write=False), "missing_permissions"),
    ],
)
def test_connect_422_repository_not_accessible(client, github, access, reason):
    pid = _project(client)["id"]
    github.access["acme/agile-app"] = access
    response = _connect(client, pid, token="ghp")
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "repository_not_accessible" and body["reason"] == reason and body["detail"]
    project = client.get(f"/api/projects/{pid}").json()
    assert project["repository"] is None and project["has_token"] is False  # nothing saved


def test_connect_502_when_github_is_down(client, github):
    pid = _project(client)["id"]

    async def down(repository: str) -> RepoAccess:
        raise CodeHostUnavailable()

    github.check_access = down  # type: ignore[method-assign]
    response = _connect(client, pid)
    assert response.status_code == 502 and response.json()["code"] == "code_host_unavailable"
    assert client.get(f"/api/projects/{pid}").json()["repository"] is None


# ---------- DELETE /api/projects/{id}/repository ----------


def test_disconnect_204_then_409(client, github):
    pid = _project(client)["id"]
    _connect(client, pid, token="ghp")
    response = client.delete(f"/api/projects/{pid}/repository")
    assert response.status_code == 204 and response.content == b""
    project = client.get(f"/api/projects/{pid}").json()
    assert project["repository"] is None and project["has_token"] is False

    again = client.delete(f"/api/projects/{pid}/repository")
    assert again.status_code == 409 and again.json()["code"] == "repository_not_connected"


def test_disconnect_404_unknown_project(client, github):
    response = client.delete("/api/projects/999/repository")
    assert response.status_code == 404 and response.json()["code"] == "project_not_found"
