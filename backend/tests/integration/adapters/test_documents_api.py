"""Every status row of spec 006's API Contract, plus the writer end to end in mock mode."""

import time

from sqlmodel import Session

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import DocumentTable, DocumentVersionTable, ProjectTable, ProposalTable
from app.domain.plan import PLANNING_STAGES
from tests.api import create_project

PROJECT = {
    "name": "Bakery shop",
    "description": "Sell bread online.",
    "members": [
        {"name": "Ana", "role": "Backend", "seniority": "senior", "hours_per_week": 30},
        {"name": "Leo", "role": "Frontend", "hours_per_week": 20},
    ],
}
EPIC_KEYS = [e["key"] for phase in MOCK_PLAN["roadmap"]["phases"] for e in phase["epics"]]
DIAGRAM = 'flowchart TD\n    A["Open"] --> B["Pay"]'


def _create(client, **overrides) -> int:
    return create_project(client, {**PROJECT, **overrides})["id"]


def _wait(check, timeout: float = 5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(0.02)
    raise AssertionError("timed out waiting for the background work")


def _assert_error(response, status: int, code: str) -> dict:
    assert response.status_code == status, response.json()
    assert response.json()["code"] == code
    return response.json()


def _document_proposals(client, pid: int, status: str | None = None) -> list[dict]:
    rows = client.get(f"/api/projects/{pid}/proposals").json()
    return [p for p in reversed(rows) if p["kind"] == "document" and (status is None or p["status"] == status)]


def _seed_document(pid: int, key: str = "general_spec", kind: str = "general_spec", content: str = "# v1", **fields) -> int:
    """A document at version 1, as if its proposal had been approved."""
    with Session(engine) as session:
        row = DocumentTable(project_id=pid, key=key, kind=kind, title=fields.pop("title", "General spec"), content=content, **fields)
        session.add(row)
        session.flush()
        session.add(DocumentVersionTable(document_id=row.id, version=1, content=content))
        session.commit()
        return row.id


def _seed_plan(pid: int) -> None:
    with Session(engine) as session:
        for stage in PLANNING_STAGES:
            session.add(ProposalTable(project_id=pid, kind="plan_stage", key=stage.key, agent="Agent", content=MOCK_PLAN[stage.key], status="approved"))
        session.commit()


# ---------- End to end: approving the sprints proposes the documents (US1-US3) ----------


def test_approving_the_plan_proposes_every_document_and_approving_one_creates_it(client):
    pid = _create(client)
    with Session(engine) as session:
        # As if the first five stages went through AdvancePlanning: proposals approved and in project.plan.
        for stage in PLANNING_STAGES[:-1]:
            session.add(ProposalTable(project_id=pid, kind="plan_stage", key=stage.key, agent="Agent", content=MOCK_PLAN[stage.key], status="approved"))
        project = session.get(ProjectTable, pid)
        project.plan = {stage.key: MOCK_PLAN[stage.key] for stage in PLANNING_STAGES[:-1]}
        session.add(project)
        session.commit()
    assert client.post(f"/api/projects/{pid}/planning").status_code == 202
    sprints = _wait(lambda: next((p for p in client.get(f"/api/projects/{pid}/proposals?status=pending").json() if p["key"] == "sprints"), None))
    assert client.post(f"/api/proposals/{sprints['id']}/approve").status_code == 200

    _wait(lambda: any(e["type"] == "documents_generated" for e in client.get(f"/api/projects/{pid}/activity?limit=200").json()))
    keys = [p["key"] for p in _document_proposals(client, pid, "pending")]
    assert keys[0] == "general_spec"
    assert keys[1 : 1 + len(EPIC_KEYS)] == [f"epic_spec:{k}" for k in EPIC_KEYS]
    assert keys[1 + len(EPIC_KEYS) :] and all(k.startswith("flow_diagram:") for k in keys[1 + len(EPIC_KEYS) :])
    assert client.get(f"/api/projects/{pid}/documents").json() == []  # nothing before approval

    general = _document_proposals(client, pid, "pending")[0]
    assert general["content"]["title"] == "General spec: Bakery shop"
    client.post(f"/api/proposals/{general['id']}/approve")
    [summary] = _wait(lambda: client.get(f"/api/projects/{pid}/documents").json())
    assert summary["kind"] == "general_spec" and summary["version"] == 1 and summary["epic_key"] is None
    assert summary["title"] == "General spec: Bakery shop" and summary["outdated"] is False
    assert summary["updated_at"].endswith("Z") or "+00:00" in summary["updated_at"]

    document = client.get(f"/api/documents/{summary['id']}").json()
    assert document["content"] == general["content"]["markdown"]
    assert document["versions"] == [
        {"version": 1, "created_at": document["versions"][0]["created_at"], "source": "agent", "proposal_id": general["id"]}
    ]


def test_auto_approve_ends_with_every_document_created(client):
    pid = _create(client, auto_approve=True)
    client.post(f"/api/projects/{pid}/planning")
    docs = _wait(lambda: (d := client.get(f"/api/projects/{pid}/documents").json()) and len(d) > 1 + len(EPIC_KEYS) and d)
    kinds = [d["kind"] for d in docs]
    assert kinds[0] == "general_spec" and kinds.count("epic_spec") == len(EPIC_KEYS) and kinds[-1] == "flow_diagram"
    assert [d["epic_key"] for d in docs if d["kind"] == "epic_spec"] == EPIC_KEYS


# ---------- GET /api/projects/{id}/documents ----------


def test_list_is_empty_before_the_plan_and_ordered_after(client):
    pid = _create(client)
    assert client.get(f"/api/projects/{pid}/documents").json() == []

    _seed_document(pid, "flow_diagram:1", "flow_diagram", DIAGRAM, title="Checkout")
    _seed_document(pid, "epic_spec:EP-10", "epic_spec", epic_key="EP-10", title="Ten")
    _seed_document(pid, "epic_spec:EP-2", "epic_spec", epic_key="EP-2", title="Two")
    _seed_document(pid)
    response = client.get(f"/api/projects/{pid}/documents")
    assert response.status_code == 200
    assert [d["title"] for d in response.json()] == ["General spec", "Two", "Ten", "Checkout"]
    assert set(response.json()[0]) == {"id", "kind", "epic_key", "title", "version", "outdated", "updated_at"}


def test_list_unknown_project(client):
    _assert_error(client.get("/api/projects/999/documents"), 404, "project_not_found")


# ---------- GET /api/documents/{id} ----------


def test_get_a_document_and_an_old_version(client):
    pid = _create(client)
    doc_id = _seed_document(pid)
    client.put(f"/api/documents/{doc_id}", json={"content": "# v2", "base_version": 1})

    latest = client.get(f"/api/documents/{doc_id}")
    assert latest.status_code == 200
    body = latest.json()
    assert (body["id"], body["project_id"], body["version"], body["content"]) == (doc_id, pid, 2, "# v2")
    assert [(v["version"], v["source"]) for v in body["versions"]] == [(1, "agent"), (2, "leader")]

    old = client.get(f"/api/documents/{doc_id}?version=1").json()
    assert (old["version"], old["content"]) == (1, "# v1") and len(old["versions"]) == 2


def test_get_unknown_document(client):
    _assert_error(client.get("/api/documents/999"), 404, "document_not_found")


def test_get_unknown_version(client):
    doc_id = _seed_document(_create(client))
    _assert_error(client.get(f"/api/documents/{doc_id}?version=7"), 404, "version_not_found")


def test_get_with_a_version_that_is_not_a_positive_integer(client):
    doc_id = _seed_document(_create(client))
    for bad in ("0", "-1", "abc"):
        body = _assert_error(client.get(f"/api/documents/{doc_id}?version={bad}"), 422, "validation_failed")
        assert [e["field"] for e in body["errors"]] == ["version"]


# ---------- POST /api/documents/{id}/regenerate ----------


def test_regenerate_proposes_a_new_version_and_keeps_the_old_one(client):
    pid = _create(client)
    _seed_plan(pid)
    doc_id = _seed_document(pid)

    response = client.post(f"/api/documents/{doc_id}/regenerate", json={"instructions": "Add the payments flow"})
    assert response.status_code == 202
    assert response.json() == {"document_id": doc_id, "status": "regenerating"}

    proposal = _wait(lambda: next(iter(_document_proposals(client, pid, "pending")), None))
    assert proposal["key"] == "general_spec" and "Add the payments flow" in proposal["content"]["markdown"]
    assert client.get(f"/api/documents/{doc_id}").json()["version"] == 1  # not before approval

    client.post(f"/api/proposals/{proposal['id']}/approve")
    document = _wait(lambda: (d := client.get(f"/api/documents/{doc_id}").json())["version"] == 2 and d)
    assert "Add the payments flow" in document["content"]
    assert [(v["version"], v["proposal_id"]) for v in document["versions"]] == [(1, None), (2, proposal["id"])]
    assert client.get(f"/api/documents/{doc_id}?version=1").json()["content"] == "# v1"


def test_regenerate_a_diagram_keeps_it_a_diagram(client):
    pid = _create(client)
    _seed_plan(pid)
    doc_id = _seed_document(pid, "flow_diagram:1", "flow_diagram", DIAGRAM, title="Architecture")
    assert client.post(f"/api/documents/{doc_id}/regenerate", json={"instructions": "Add the cache"}).status_code == 202

    proposal = _wait(lambda: next(iter(_document_proposals(client, pid, "pending")), None))
    assert proposal["key"] == "flow_diagram:1" and proposal["content"]["title"] == "Architecture"
    assert proposal["content"]["mermaid"].startswith("flowchart")


def test_regenerate_with_a_body_that_is_not_json(client):
    doc_id = _seed_document(_create(client))
    url = f"/api/documents/{doc_id}/regenerate"
    _assert_error(client.post(url, content="instructions", headers={"Content-Type": "text/plain"}), 400, "malformed_request")
    _assert_error(client.post(url, content="{oops", headers={"Content-Type": "application/json"}), 400, "malformed_request")


def test_regenerate_unknown_document(client):
    _assert_error(client.post("/api/documents/999/regenerate", json={"instructions": "x"}), 404, "document_not_found")


def test_regenerate_while_its_proposal_is_pending(client):
    pid = _create(client)
    doc_id = _seed_document(pid)
    with Session(engine) as session:
        session.add(ProposalTable(project_id=pid, kind="document", key="general_spec", agent="Spec writer", content={}, status="pending"))
        session.commit()
    _assert_error(client.post(f"/api/documents/{doc_id}/regenerate", json={"instructions": "x"}), 409, "regeneration_in_progress")


def test_regenerate_with_invalid_instructions(client):
    doc_id = _seed_document(_create(client))
    url = f"/api/documents/{doc_id}/regenerate"
    for body in ({}, {"instructions": "   "}, {"instructions": "x" * 2001}):
        errors = _assert_error(client.post(url, json=body), 422, "validation_failed")["errors"]
        assert [e["field"] for e in errors] == ["instructions"]


# ---------- PUT /api/documents/{id} ----------


def test_edit_saves_a_new_version_and_clears_outdated(client):
    pid = _create(client)
    doc_id = _seed_document(pid, outdated=True)
    response = client.put(f"/api/documents/{doc_id}", json={"content": "# Mine", "base_version": 1})

    assert response.status_code == 200
    body = response.json()
    assert (body["version"], body["content"], body["outdated"]) == (2, "# Mine", False)
    assert [(v["version"], v["source"], v["proposal_id"]) for v in body["versions"]] == [(1, "agent", None), (2, "leader", None)]
    assert _document_proposals(client, pid) == []  # a leader's edit isn't a proposal


def test_edit_with_a_body_that_is_not_json(client):
    doc_id = _seed_document(_create(client))
    response = client.put(f"/api/documents/{doc_id}", content="# x", headers={"Content-Type": "text/markdown"})
    _assert_error(response, 400, "malformed_request")


def test_edit_unknown_document(client):
    _assert_error(client.put("/api/documents/999", json={"content": "# x", "base_version": 1}), 404, "document_not_found")


def test_edit_an_old_version_is_a_conflict(client):
    doc_id = _seed_document(_create(client))
    client.put(f"/api/documents/{doc_id}", json={"content": "# v2", "base_version": 1})
    body = _assert_error(client.put(f"/api/documents/{doc_id}", json={"content": "# v2 bis", "base_version": 1}), 409, "version_conflict")
    assert body["current_version"] == 2
    assert client.get(f"/api/documents/{doc_id}").json()["content"] == "# v2"


def test_edit_with_invalid_fields(client):
    doc_id = _seed_document(_create(client))
    url = f"/api/documents/{doc_id}"
    cases = [
        ({"content": "", "base_version": 1}, ["content"]),
        ({"content": "x" * 100_001, "base_version": 1}, ["content"]),
        ({"content": "# x"}, ["base_version"]),
    ]
    for body, fields in cases:
        errors = _assert_error(client.put(url, json=body), 422, "validation_failed")["errors"]
        assert [e["field"] for e in errors] == fields


def test_edit_a_diagram_that_would_not_render(client):
    doc_id = _seed_document(_create(client), "flow_diagram:1", "flow_diagram", DIAGRAM, title="Checkout")
    response = client.put(f"/api/documents/{doc_id}", json={"content": 'flowchart TD\n    A["Open --> <br>', "base_version": 1})
    body = _assert_error(response, 422, "invalid_diagram")
    assert len(body["errors"]) == 2 and all(e["field"] == "content" for e in body["errors"])
    assert client.get(f"/api/documents/{doc_id}").json()["version"] == 1
