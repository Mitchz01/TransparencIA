"""Every status row of spec 007's API Contract (repository, issues, GitHub usernames)."""

import time

import pytest
from sqlmodel import Session

from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import TaskTable
from app.domain.errors import CodeHostUnavailable
from app.domain.integrations import RepoAccess

PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "Frontend"}],
}


@pytest.fixture
def github(client) -> FakeCodeHost:
    """The app's FakeCodeHost: tests force MOCK_GITHUB, so every project gets it, whatever its token."""
    host = client.app.state.code_host_factory("any-token")
    assert isinstance(host, FakeCodeHost) and host is client.app.state.code_host_factory(None)
    return host


def _project(client) -> dict:
    return client.post("/api/projects", json=PROJECT).json()


def _tasks(project_id: int, count: int = 2) -> list[int]:
    """Board tasks straight in the DB (spec 003 builds them; not merged here)."""
    with Session(engine) as session:
        rows = [TaskTable(project_id=project_id, key=f"US-{i + 1}", title=f"Task {i + 1}", position=i) for i in range(count)]
        session.add_all(rows)
        session.commit()
        return [row.id for row in rows]


def _wait_for(check, attempts: int = 100):
    """Applying runs in the background: poll until `check()` returns something truthy."""
    for _ in range(attempts):
        value = check()
        if value:
            return value
        time.sleep(0.01)
    raise AssertionError("background work didn't finish")


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


# ---------- POST /api/projects/{id}/issues/propose ----------


def _applied(client, proposal_id: int) -> dict | None:
    proposal = client.get(f"/api/proposals/{proposal_id}").json()
    return proposal if proposal["result"] else None


def test_propose_201_then_approve_publishes_the_issues(client, github):
    pid = _project(client)["id"]
    _connect(client, pid)
    task_ids = _tasks(pid)
    response = client.post(f"/api/projects/{pid}/issues/propose")
    assert response.status_code == 201
    body = response.json()
    assert body["task_count"] == 2 and response.headers["Location"] == f"/api/proposals/{body['proposal_id']}"

    proposal = client.get(f"/api/proposals/{body['proposal_id']}").json()
    assert (proposal["kind"], proposal["key"], proposal["status"]) == ("github_action", "create_issues", "pending")
    assert [t["task_id"] for t in proposal["content"]["tasks"]] == task_ids

    assert client.post(f"/api/proposals/{body['proposal_id']}/approve").status_code == 200
    applied = _wait_for(lambda: _applied(client, body["proposal_id"]))
    assert applied["apply_failed"] is False
    assert applied["result"] == {
        "created": [{"task_id": task_ids[0], "number": 1}, {"task_id": task_ids[1], "number": 2}],
        "failed": [],
    }
    assert [c["title"] for c in github.called("create_issue")] == ["Task 1", "Task 2"]
    activity = client.get(f"/api/projects/{pid}/activity").json()
    published = next(e for e in activity if e["type"] == "issues_published")
    assert published["proposal_id"] == body["proposal_id"]
    assert published["created"][0] == {"task_id": task_ids[0], "number": 1}


def test_connecting_with_a_board_proposes_and_auto_approve_publishes(client, github):
    pid = client.post("/api/projects", json={**PROJECT, "auto_approve": True}).json()["id"]
    _tasks(pid, 3)
    assert _connect(client, pid).status_code == 200
    _wait_for(lambda: len(github.called("create_issue")) == 3)
    [proposal] = client.get(f"/api/projects/{pid}/proposals").json()
    assert proposal["auto_approved"] is True and proposal["key"] == "create_issues"

    nothing = client.post(f"/api/projects/{pid}/issues/propose")
    assert nothing.status_code == 409 and nothing.json()["code"] == "nothing_to_publish"


def test_propose_404_unknown_project(client, github):
    response = client.post("/api/projects/999/issues/propose")
    assert response.status_code == 404 and response.json()["code"] == "project_not_found"


def test_propose_409_repository_not_connected(client, github):
    pid = _project(client)["id"]
    _tasks(pid)
    response = client.post(f"/api/projects/{pid}/issues/propose")
    assert response.status_code == 409 and response.json()["code"] == "repository_not_connected"


def test_propose_409_nothing_to_publish(client, github):
    pid = _project(client)["id"]
    _connect(client, pid)  # empty board: connecting proposes nothing
    response = client.post(f"/api/projects/{pid}/issues/propose")
    assert response.status_code == 409 and response.json()["code"] == "nothing_to_publish"


def test_propose_409_publication_pending(client, github):
    pid = _project(client)["id"]
    _tasks(pid)
    _connect(client, pid)  # board + repo: proposed on connect
    [pending] = client.get(f"/api/projects/{pid}/proposals").json()
    response = client.post(f"/api/projects/{pid}/issues/propose")
    assert response.status_code == 409
    assert response.json()["code"] == "publication_pending" and response.json()["proposal_id"] == pending["id"]
