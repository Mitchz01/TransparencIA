"""Spec 004's API Contract: GET /api/projects/{id}/plan."""

from sqlmodel import Session

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ProjectTable, ProposalTable, TaskTable
from tests.api import create_project

PROJECT = {"name": "Agile Planner", "description": "Plans the work.", "members": [{"name": "Ana", "role": "Backend"}]}


def test_plan_views(client):
    pid = create_project(client, PROJECT)["id"]

    empty = client.get(f"/api/projects/{pid}/plan").json()
    assert empty["roadmap"] == {"status": "not_generated", "origin": None, "content": None}

    with Session(engine) as session:
        project = session.get(ProjectTable, pid)
        project.plan = {"roadmap": MOCK_PLAN["roadmap"], "methodology": MOCK_PLAN["methodology"]}
        project.status = "ready"
        session.add(project)
        for key in ("roadmap", "methodology", "sprints"):
            session.add(ProposalTable(project_id=pid, kind="plan_stage", key=key, agent="Agent", content=MOCK_PLAN[key], status="approved", resolved_at=project.created_at))
        session.add(ProposalTable(project_id=pid, kind="plan_stage", key="architecture", agent="Architect", content=MOCK_PLAN["architecture"]))
        for done in (True, True, False):
            session.add(TaskTable(project_id=pid, key="US-1", epic_key="EP-1", title="t", points=3, status="done" if done else "todo"))
        session.commit()

    views = client.get(f"/api/projects/{pid}/plan").json()
    roadmap = views["roadmap"]
    assert roadmap["status"] == "approved" and roadmap["origin"]["decision"] == "leader"
    ep1 = roadmap["content"]["phases"][0]["epics"][0]
    assert ep1["progress"] == {"tasks": 3, "tasks_done": 2, "points": 9, "points_done": 6}
    assert roadmap["content"]["current_week"] == 1 and roadmap["content"]["current_phase"] == "Foundations"
    assert views["methodology"]["content"]["chosen_by"] == "agents"
    assert views["architecture"] == {"status": "pending", "origin": None, "content": None}

    assert client.get("/api/projects/999/plan").json()["code"] == "project_not_found"
