"""Every status row of spec 002's API Contract, plus the pipeline end to end in mock mode."""

import time

from sqlmodel import Session

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ProjectTable, ProposalTable
from app.domain.plan import PLANNING_STAGES

STAGE_KEYS = [stage.key for stage in PLANNING_STAGES]
PROJECT = {
    "name": "Agile Planner",
    "description": "Plans the work.",
    "members": [
        {"name": "Ana", "role": "Backend", "seniority": "senior", "hours_per_week": 30},
        {"name": "Leo", "role": "Frontend", "hours_per_week": 20},
    ],
}


def _create(client, **overrides) -> int:
    return client.post("/api/projects", json={**PROJECT, **overrides}).json()["id"]


def _wait(check, timeout: float = 5.0):
    """Agents run in the background: poll until `check()` returns something truthy."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(0.02)
    raise AssertionError("timed out waiting for the background work")


def _proposals(client, pid: int, key: str | None = None) -> list[dict]:
    """Oldest first."""
    rows = client.get(f"/api/projects/{pid}/proposals").json()
    return [p for p in reversed(rows) if key is None or p["key"] == key]


def _pending(client, pid: int, key: str) -> dict | None:
    return next((p for p in _proposals(client, pid, key) if p["status"] == "pending"), None)


def _assert_error(response, status: int, code: str):
    assert response.status_code == status, response.json()
    assert response.json()["code"] == code


def _set_status(pid: int, status: str) -> None:
    with Session(engine) as session:
        row = session.get(ProjectTable, pid)
        row.status = status
        session.add(row)
        session.commit()


# ---------- POST /api/projects/{id}/planning ----------


def test_auto_approve_generates_the_whole_plan_and_the_board(client):
    pid = _create(client, auto_approve=True)
    response = client.post(f"/api/projects/{pid}/planning")
    assert response.status_code == 202
    assert response.json() == {"project_id": pid, "status": "planning", "stage": "analysis"}

    project = _wait(lambda: (p := client.get(f"/api/projects/{pid}").json())["status"] == "ready" and p)
    proposals = [p for p in _proposals(client, pid) if p["kind"] == "plan_stage"]  # documents follow (spec 006)
    assert [p["key"] for p in proposals] == STAGE_KEYS
    assert all(p["status"] == "approved" and p["auto_approved"] and p["rationale"] for p in proposals)
    assert set(project["plan"]) == set(STAGE_KEYS)

    board = client.get(f"/api/projects/{pid}/board").json()
    assert len(board["tasks"]) == len(MOCK_PLAN["backlog"]["stories"])
    assert not any(s["load"]["overloaded"] for s in board["sprints"])  # same capacity rule (FR-010)

    events = list(reversed(client.get(f"/api/projects/{pid}/activity?limit=200").json()))
    types = [e["type"] for e in events]
    assert types[0] == "agent_started"
    assert [e["agent"] for e in events if e["type"] == "agent_started"][:6] == STAGE_KEYS
    assert types.index("plan_completed") < types.index("plan_applied")

    _assert_error(client.post(f"/api/projects/{pid}/planning"), 409, "planning_not_startable")


def test_completed_plan_builds_the_board_proposes_issues_and_writes_the_documents(client):
    """on_plan_completed in order: ApplyPlan (spec 003) with ProposePendingIssues (spec 007)
    as its follow-up, then GenerateDocuments (spec 006). Leader-approved, to see each step."""
    pid = _create(client)
    assert client.put(f"/api/projects/{pid}/repository", json={"repository": "acme/agile-app"}).status_code == 200
    assert client.post(f"/api/projects/{pid}/planning").status_code == 202
    for key in STAGE_KEYS:
        proposal = _wait(lambda: _pending(client, pid, key))
        assert client.post(f"/api/proposals/{proposal['id']}/approve").status_code == 200

    _wait(lambda: client.get(f"/api/projects/{pid}").json()["status"] == "ready")
    board = client.get(f"/api/projects/{pid}/board").json()
    issues = _wait(lambda: _pending(client, pid, "create_issues"))
    assert [t["task_id"] for t in issues["content"]["tasks"]] == [t["id"] for t in board["tasks"]]
    documents = _wait(lambda: [p for p in _proposals(client, pid) if p["kind"] == "document"])
    assert any(p["key"] == "general_spec" for p in documents)

    _wait(lambda: "documents_generated" in [e["type"] for e in client.get(f"/api/projects/{pid}/activity?limit=200").json()])
    events = list(reversed(client.get(f"/api/projects/{pid}/activity?limit=200").json()))
    types = [e["type"] for e in events]
    created = [(i, e["kind"], e["key"]) for i, e in enumerate(events) if e["type"] == "proposal_created"]
    issues_created = next(i for i, kind, key in created if key == "create_issues")
    first_document = next(i for i, kind, _ in created if kind == "document")
    assert types.index("plan_completed") < types.index("plan_applied") < issues_created < first_document


def test_stage_by_stage_with_manual_approval(client):
    pid = _create(client, requested_methodology="kanban")
    assert client.post(f"/api/projects/{pid}/planning").status_code == 202
    analysis = _wait(lambda: _pending(client, pid, "analysis"))
    assert analysis["agent"] == "Product analyst" and analysis["rationale"]

    _assert_error(client.post(f"/api/projects/{pid}/planning"), 409, "planning_already_running")

    assert client.post(f"/api/proposals/{analysis['id']}/approve").status_code == 200
    methodology = _wait(lambda: _pending(client, pid, "methodology"))
    assert methodology["content"]["methodology"] == "kanban"  # the leader's choice is respected

    # Rejecting with a reason redoes the stage without any other action (US4)
    client.post(f"/api/proposals/{methodology['id']}/reject", json={"reason": "Shorter iterations"})
    redo = _wait(lambda: _pending(client, pid, "methodology"))
    assert redo["id"] != methodology["id"]
    assert client.get(f"/api/proposals/{methodology['id']}").json()["rejection_reason"] == "Shorter iterations"


def test_start_unknown_project(client):
    _assert_error(client.post("/api/projects/999/planning"), 404, "project_not_found")


def test_resume_after_an_error_skips_approved_stages(client):
    pid = _create(client)
    with Session(engine) as session:
        for key in STAGE_KEYS[:4]:
            session.add(ProposalTable(project_id=pid, kind="plan_stage", key=key, agent="Agent", content=MOCK_PLAN[key], status="approved"))
        session.commit()
    _set_status(pid, "error")

    response = client.post(f"/api/projects/{pid}/planning")
    assert response.status_code == 202 and response.json()["stage"] == "backlog"
    _wait(lambda: _pending(client, pid, "backlog"))
    assert [p["key"] for p in _proposals(client, pid)] == [*STAGE_KEYS[:4], "backlog"]


# ---------- POST /api/projects/{id}/planning/stages/{key}/retry ----------


def _capped_roadmap(pid: int) -> None:
    with Session(engine) as session:
        for reason in ("Too long", "Still too long", "It's 4 weeks, not 8"):
            session.add(
                ProposalTable(
                    project_id=pid, kind="plan_stage", key="roadmap", agent="Product manager",
                    content=MOCK_PLAN["roadmap"], status="rejected", rejection_reason=reason,
                )
            )
        session.commit()
    _set_status(pid, "planning")


def test_retry_a_capped_stage(client):
    pid = _create(client)
    _capped_roadmap(pid)
    response = client.post(f"/api/projects/{pid}/planning/stages/roadmap/retry")
    assert response.status_code == 202
    assert response.json() == {"project_id": pid, "status": "planning", "stage": "roadmap"}
    _wait(lambda: _pending(client, pid, "roadmap"))


def test_retry_errors(client):
    pid = _create(client)
    _assert_error(client.post("/api/projects/999/planning/stages/roadmap/retry"), 404, "project_not_found")
    _assert_error(client.post(f"/api/projects/{pid}/planning/stages/design/retry"), 404, "stage_not_found")
    _assert_error(client.post(f"/api/projects/{pid}/planning/stages/roadmap/retry"), 409, "stage_not_retryable")
