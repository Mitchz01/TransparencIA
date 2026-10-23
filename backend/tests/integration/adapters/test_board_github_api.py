"""Spec 003 board ↔ spec 007 GitHub integration: issue links in the board, issue sync on
edits and the ApplyPlan follow-up that proposes publishing the new board."""

import asyncio
import time

from sqlmodel import Session

from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ExternalLinkTable, ProjectTable
from app.application.use_cases.planning.apply_plan import ApplyPlan
from tests.fakes import RecordingEventBus
from tests.api import create_project

REPO = "acme/agile-app"
PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [{"name": "Ana", "role": "Backend"}, {"name": "Leo", "role": "Frontend"}],
}


def _project_with_plan(client) -> int:
    pid = create_project(client, PROJECT)["id"]
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.plan = MOCK_PLAN
        session.add(row)
        session.commit()
    return pid


def _connect(client, pid: int) -> None:
    assert client.put(f"/api/projects/{pid}/repository", json={"repository": REPO}).status_code == 200


def _link(pid: int, task_id: int, number: int, **fields) -> None:
    with Session(engine) as session:
        session.add(
            ExternalLinkTable(
                project_id=pid, task_id=task_id, kind="issue", repository=REPO, number=number,
                url=f"https://github.com/{REPO}/issues/{number}", **fields,
            )
        )
        session.commit()


def _complete_plan(client, pid: int) -> None:
    """What AdvancePlanning does after the last stage: run the app's on_plan_completed handlers
    (wire_planning registers ApplyPlan there, with 007's ProposePendingIssues as its follow-up)."""
    for handler in client.app.state.on_plan_completed:
        asyncio.run(handler(pid))


def _wait_for(check, attempts: int = 100):
    for _ in range(attempts):
        value = check()
        if value:
            return value
        time.sleep(0.01)
    raise AssertionError("background work didn't finish")


def test_board_returns_each_tasks_issue_or_null(client):
    pid = _project_with_plan(client)
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    first, second, *rest = client.get(f"/api/projects/{pid}/board").json()["tasks"]
    _link(pid, first["id"], 12)
    _link(pid, second["id"], 7, broken=True)
    _link(pid, second["id"], 13, state="closed")  # republished: the newest link wins

    tasks = {t["id"]: t for t in client.get(f"/api/projects/{pid}/board").json()["tasks"]}
    assert tasks[first["id"]]["issue"] == {
        "number": 12, "url": f"https://github.com/{REPO}/issues/12", "state": "open", "broken": False,
    }
    assert tasks[second["id"]]["issue"] == {
        "number": 13, "url": f"https://github.com/{REPO}/issues/13", "state": "closed", "broken": False,
    }
    assert rest and all(tasks[t["id"]]["issue"] is None for t in rest)

    # The task results of PATCH return the same Task shape
    response = client.patch(f"/api/tasks/{first['id']}", json={"priority": "high"})
    assert response.json()["task"]["issue"]["number"] == 12


def test_editing_a_published_task_updates_its_issue(client):
    github = client.app.state.code_host_factory(None)
    assert isinstance(github, FakeCodeHost)
    pid = _project_with_plan(client)
    asyncio.run(ApplyPlan(open_uow, RecordingEventBus()).execute(pid))
    _connect(client, pid)
    published, unpublished, *_ = client.get(f"/api/projects/{pid}/board").json()["tasks"]
    _link(pid, published["id"], 12)
    proposals_before = client.get(f"/api/projects/{pid}/proposals").json()  # connecting proposed the board (FR-006)

    # A pure move doesn't touch the issue
    assert client.patch(f"/api/tasks/{published['id']}", json={"status": "in_progress"}).status_code == 200
    assert client.patch(f"/api/tasks/{unpublished['id']}", json={"title": "Not on GitHub"}).status_code == 200
    assert client.patch(f"/api/tasks/{published['id']}", json={"title": "Sign in with email"}).status_code == 200

    [update] = _wait_for(lambda: github.called("update_issue"))
    assert (update["repository"], update["number"], update["title"]) == (REPO, 12, "Sign in with email")
    activity = _wait_for(
        lambda: [e for e in client.get(f"/api/projects/{pid}/activity").json() if e["type"] == "issue_updated"]
    )
    assert (activity[0]["task_id"], activity[0]["number"]) == (published["id"], 12)
    assert client.get(f"/api/projects/{pid}/proposals").json() == proposals_before  # no new proposal (FR-021)

    # Editing the checklist changes the issue body too
    items = [{"text": "Form", "done": True}]
    assert client.put(f"/api/tasks/{published['id']}/checklist", json={"items": items}).status_code == 200
    _wait_for(lambda: len(github.called("update_issue")) == 2)
    assert "- [x] Form" in github.called("update_issue")[1]["body"]


def test_applying_a_plan_with_a_connected_repo_proposes_the_issues(client):
    pid = _project_with_plan(client)
    _connect(client, pid)
    assert client.get(f"/api/projects/{pid}/proposals").json() == []  # no board yet: nothing proposed

    _complete_plan(client, pid)

    board = client.get(f"/api/projects/{pid}/board").json()
    proposals = client.get(f"/api/projects/{pid}/proposals").json()
    [proposal] = [p for p in proposals if p["kind"] == "github_action"]
    assert (proposal["key"], proposal["status"]) == ("create_issues", "pending")
    assert [t["task_id"] for t in proposal["content"]["tasks"]] == [t["id"] for t in board["tasks"]]
    # The whole on_plan_completed chain ran: ApplyPlan (+ issues), then spec 006's writer
    assert {"general_spec", "flow_diagram"} <= {p["key"].split(":")[0] for p in proposals if p["kind"] == "document"}


def test_applying_a_plan_without_a_repo_proposes_no_issues(client):
    pid = _project_with_plan(client)
    _complete_plan(client, pid)
    assert client.get(f"/api/projects/{pid}/board").json()["tasks"]
    proposals = client.get(f"/api/projects/{pid}/proposals").json()
    assert proposals and all(p["kind"] == "document" for p in proposals)  # only spec 006's documents
