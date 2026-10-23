"""The demo seed (spec 017, FR-017, D11): the mangrove project with its published portal, loaded once."""

import datetime as dt

from sqlmodel import Session, func, select

from app import seed
from app.adapters.inbound.http import dependencies as deps
from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.tables import ExpenseTable, SprintTable, TaskTable

TODAY = dt.date(2026, 10, 23)


def _counts() -> tuple[int, int, int, int]:
    with Session(engine) as session:
        return tuple(  # type: ignore[return-value]
            session.exec(select(func.count()).select_from(table)).one() for table in (SprintTable, TaskTable, ExpenseTable)
        ) + (session.exec(select(func.count()).select_from(SprintTable).where(SprintTable.closed)).one(),)


def test_the_seed_publishes_the_mangrove_portal_and_running_it_twice_changes_nothing(client, anonymous, capsys):
    client.app.dependency_overrides[deps.today] = lambda: TODAY
    try:
        seed.main()
        first = _counts()
        seed.main()
        assert _counts() == first == (6, 16, 3, 2)  # sprints, tasks, expenses, closed sprints

        response = anonymous.get(f"/api/public/projects/{seed.PORTAL_SLUG}")
        assert response.status_code == 200, response.text
        portal = response.json()
    finally:
        client.app.dependency_overrides.pop(deps.today, None)

    assert portal["project"]["name"] == "Restauración de manglar en la Ciénaga Grande"
    assert portal["project"]["contracting_entity"] == "Corpamag" and portal["project"]["end_date"] == "2027-01-31"
    assert portal["public_url"] == f"/p/{seed.PORTAL_SLUG}"
    assert [line["id"] for line in portal["lines"]] == ["R1", "R2", "R3", "R4"]
    assert [(line["id"], line["spent"]) for line in portal["lines"][:2]] == [("R1", 32_400_000), ("R2", 0)]
    assert len(portal["expenses"]) == 3 and portal["summary"]["spent"] == 32_400_000
    assert portal["summary"]["physical_pct"] == 34.1
    assert [a["level"] for a in portal["alerts"]] == ["medium"] and portal["alerts"][0]["answer"] is None
    assert portal["summary"]["light"] == "yellow"  # the open alert, as the demo wants
    assert [s["name"] for s in portal["sprints"]][:3] == ["Diagnóstico", "Vivero", "Siembra lotes 1–2"]
    assert len(portal["timeline"]) == 12 and sum(len(week["tasks_done"]) for week in portal["timeline"]) == 7
    for expense in portal["expenses"]:
        assert anonymous.get(expense["file_url"]).status_code == 200  # the evidence is public with the portal


def test_the_seeded_team_sees_the_project_and_its_portal(client, capsys):
    seed.main()
    ana = seed.sign_in_or_up  # sign in as the leader through the same helper the seed uses
    ana(client, seed.ACCOUNTS[0])
    project = next(p for p in client.get("/api/projects").json() if p["name"] == seed.PROJECT["name"])
    assert project["status"] == "ready"
    portal = client.get(f"/api/projects/{project['id']}/transparency")
    assert portal.status_code == 200, portal.text
    assert portal.json()["public"] is True and portal.json()["public_url"] == f"/p/{seed.PORTAL_SLUG}" and portal.json()["drafts"] == []
