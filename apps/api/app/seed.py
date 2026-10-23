"""Demo seed (specs 015 and 017): two accounts to sign in with and the mangrove restoration project.

    cd apps/api && python -m app.seed

The accounts and the project come through the real API in-process (the same app as `fastapi dev`, on
DATABASE_URL), so passwords are hashed, profiles validated and the team formed with the invitation link
exactly as in the app. The planned board, the budget, the evidence and the published portal are written
straight through the repositories: no agent runs, so the demo works even if the AI is down (spec 017,
FR-017, D11).

Running it again changes nothing: existing accounts are signed in, and the project is filled once.
"""

import base64
import datetime as dt
from pathlib import Path

from fastapi.testclient import TestClient

from app.adapters.inbound.http.dependencies import open_uow
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.board import Sprint, Task
from app.domain.transparency import Alert, Budget, BudgetLine, Expense, StoredFile
from app.main import app

PASSWORD = "agile-demo"

# Ana leads the demo project; Leo joins it with the link, so he sees the member view.
# Their photos are Pexels portraits that the frontend serves (apps/team/public/avatars/).
ACCOUNTS = [
    {
        "name": "Ana Gómez",
        "email": "ana@team.dev",
        "profile": {
            "role": "Bióloga marina",
            "seniority": "senior",
            "hours_per_week": 30,
            "skills": ["Restauración de manglar", "Monitoreo"],
            "avatar_url": "/avatars/ana-gomez.jpg",
        },
    },
    {
        "name": "Leo Ruiz",
        "email": "leo@team.dev",
        "profile": {
            "role": "Coordinador de campo",
            "seniority": "mid",
            "hours_per_week": 20,
            "skills": ["Logística fluvial", "Talleres comunitarios"],
            "avatar_url": "/avatars/leo-ruiz.jpg",
        },
    },
]

PROJECT = {
    "name": "Restauración de manglar en la Ciénaga Grande",
    "description": (
        "Restauración de 5 ha de manglar en la Ciénaga Grande de Santa Marta: vivero, siembra, "
        "mantenimiento, monitoreo y talleres con la comunidad. Contrato con Corpamag por $180.000.000, 6 meses."
    ),
    "duration_weeks": 26,
    "requested_methodology": "scrum",
}

# The portal's link is fixed so the printed QR never changes (plan.md, D9).
PORTAL_SLUG = "manglar-cienaga"

BUDGET = Budget(
    project_id=0,  # set once the project exists
    contracting_entity="Corpamag",
    contractor="Fundación Manglares Vivos",
    contract_value=180_000_000,
    start_date=dt.date(2026, 8, 3),
    lines=[
        BudgetLine(id="R1", name="Plántulas de mangle", amount=45_000_000),
        BudgetLine(id="R2", name="Mano de obra local", amount=70_000_000),
        BudgetLine(id="R3", name="Logística y transporte fluvial", amount=30_000_000),
        BudgetLine(id="R4", name="Monitoreo y talleres comunitarios", amount=35_000_000),
    ],
)

# One sprint per phase, ~4 weeks each; the first two are closed. Today in the story is 2026-10-23.
SPRINTS = [
    ("Diagnóstico", "Conocer el sitio y concertar con la comunidad", dt.date(2026, 8, 23), True),
    ("Vivero", "Tener las plántulas listas y la cuadrilla capacitada", dt.date(2026, 9, 13), True),
    ("Siembra lotes 1–2", "Sembrar las primeras 2 ha", dt.date(2026, 10, 25), False),
    ("Siembra lotes 3–5", "Sembrar las 3 ha restantes", dt.date(2026, 11, 22), False),
    ("Mantenimiento", "Reponer plántulas y cuidar los canales", dt.date(2026, 12, 20), False),
    ("Monitoreo y cierre", "Medir la supervivencia y cerrar con la comunidad", dt.date(2027, 1, 31), False),
]

# (sprint number, title, points, status, day it was done). Done tasks come to ~34% of the points.
TASKS: list[tuple[int, str, int, str, dt.date | None]] = [
    (1, "Diagnóstico del sitio y mapeo de zonas degradadas", 5, "done", dt.date(2026, 8, 12)),
    (1, "Muestreo de salinidad y flujo hídrico", 3, "done", dt.date(2026, 8, 19)),
    (1, "Concertar permisos con la comunidad pescadora", 3, "done", dt.date(2026, 8, 21)),
    (2, "Comprar plántulas", 3, "done", dt.date(2026, 8, 24)),
    (2, "Instalar vivero comunitario", 5, "done", dt.date(2026, 8, 31)),
    (2, "Capacitar cuadrilla en técnicas de siembra", 3, "done", dt.date(2026, 9, 9)),
    (3, "Sembrar lote 1 (1 ha)", 8, "done", dt.date(2026, 9, 15)),
    (3, "Sembrar lote 2 (1 ha)", 8, "in_progress", None),
    (3, "Taller comunitario de seguimiento", 3, "todo", None),
    (4, "Sembrar lote 3 (1 ha)", 8, "todo", None),
    (4, "Sembrar lote 4 (1 ha)", 8, "todo", None),
    (4, "Sembrar lote 5 (1 ha)", 8, "todo", None),
    (5, "Reposición de plántulas perdidas", 5, "todo", None),
    (5, "Limpieza de canales y control de sedimentos", 5, "todo", None),
    (6, "Monitoreo de supervivencia y crecimiento", 8, "todo", None),
    (6, "Informe final y taller de cierre con la comunidad", 5, "todo", None),
]

# The live demo files (apps/api/demo/) when they exist; a tiny placeholder otherwise.
DEMO_DIR = Path(__file__).resolve().parents[1] / "demo"
PLACEHOLDER_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
PLACEHOLDER_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def _evidence_file(name: str, mime: str, fallback: bytes, fallback_mime: str) -> tuple[str, str, bytes]:
    path = DEMO_DIR / name
    if path.is_file():
        return name, mime, path.read_bytes()
    return name, fallback_mime, fallback


def _at(day: dt.date, hour: int = 12) -> dt.datetime:
    return dt.datetime(day.year, day.month, day.day, hour, tzinfo=dt.timezone.utc)


def _check(response, action: str) -> dict:
    if response.status_code >= 400:
        raise SystemExit(f"{action} failed: {response.status_code} {response.text}")
    return response.json() if response.content else {}


def sign_in_or_up(client: TestClient, account: dict) -> str:
    """Signs in as the account, creating it (with its profile) the first time. Returns what happened."""
    client.cookies.clear()
    response = client.post("/api/auth/signin", json={"email": account["email"], "password": PASSWORD})
    if response.status_code == 200:
        # Accounts seeded before the photos existed get theirs; a photo already set is kept.
        if response.json().get("avatar_url") is None:
            photo = {"avatar_url": account["profile"]["avatar_url"]}
            _check(client.patch("/api/me", json=photo), f"Saving {account['email']}'s photo")
            return "existing, photo added"
        return "existing"
    if response.json().get("code") != "invalid_credentials":
        _check(response, f"Signing in as {account['email']}")
    created = client.post("/api/auth/signup", json={"name": account["name"], "email": account["email"], "password": PASSWORD})
    if created.status_code == 422:
        raise SystemExit(f"{account['email']} already exists with another password; sign in with yours or delete agile.db.")
    _check(created, f"Signing up {account['email']}")
    _check(client.patch("/api/me", json=account["profile"]), f"Saving {account['email']}'s profile")
    return "created"


def fill_mangrove_project(uow: UnitOfWork, project_id: int) -> None:
    """The planned board, the budget, three confirmed pieces of evidence and the published portal.
    One commit: either the whole story is there or none of it."""
    project = uow.projects.get(project_id)
    assert project is not None

    sprints: dict[int, Sprint] = {}
    for number, (name, goal, end, closed) in enumerate(SPRINTS, start=1):
        sprints[number] = uow.sprints.add(
            Sprint(project_id=project_id, number=number, name=name, goal=goal, phase=name, closed=closed, end_date=end)
        )

    tasks: dict[str, Task] = {}
    positions: dict[tuple[int, str], int] = {}
    for index, (number, title, points, status, done_on) in enumerate(TASKS, start=1):
        column = (number, status)
        positions[column] = positions.get(column, -1) + 1
        tasks[title] = uow.tasks.add(
            Task(
                project_id=project_id,
                sprint_id=sprints[number].id,
                key=f"MV-{index}",
                title=title,
                points=points,
                status=status,  # type: ignore[arg-type]
                position=positions[column],
                done_at=_at(done_on, 15) if done_on else None,
            )
        )

    uow.budgets.save(BUDGET.model_copy(update={"project_id": project_id}))

    def evidence(file: tuple[str, str, bytes], **fields) -> None:
        name, mime, data = file
        stored = uow.files.add(StoredFile(project_id=project_id, name=name, mime=mime, data=data))
        day = fields["date"]
        uow.expenses.add(
            Expense(project_id=project_id, file_id=stored.id, mime=mime, status="confirmed", created_at=_at(day), **fields)  # type: ignore[arg-type]
        )

    seedlings = tasks["Comprar plántulas"]
    planting = tasks["Sembrar lote 1 (1 ha)"]
    evidence(
        _evidence_file("factura-vivero.pdf", "application/pdf", PLACEHOLDER_PDF, "application/pdf"),
        kind="invoice",
        amount=30_000_000,
        date=dt.date(2026, 8, 20),
        supplier="Vivero Ciénaga Viva",
        concept="20.000 plántulas de Rhizophora mangle",
        budget_line_id="R1",
        task_id=seedlings.id,
        task_title=seedlings.title,
        citizen_summary="Compra de 20.000 plántulas de mangle rojo para la siembra.",
    )
    evidence(
        _evidence_file("foto-siembra.jpg", "image/jpeg", PLACEHOLDER_PNG, "image/png"),
        kind="field_photo",
        date=dt.date(2026, 9, 15),
        concept="Siembra de la primera hectárea",
        budget_line_id="R2",
        task_id=planting.id,
        task_title=planting.title,
        citizen_summary="La cuadrilla local sembrando la primera hectárea de manglar.",
    )
    evidence(
        _evidence_file("factura-restaurante.jpg", "image/jpeg", PLACEHOLDER_PNG, "image/png"),
        kind="invoice",
        amount=2_400_000,
        date=dt.date(2026, 10, 2),
        supplier="Restaurante El Muelle",
        concept="Almuerzos",
        budget_line_id="R1",
        citizen_summary="Almuerzos para la cuadrilla de campo.",
        alerts=[
            Alert(
                level="medium",
                source="ai",
                reason="El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.",
            )
        ],
    )

    # Published with a fixed link, so the printed QR never changes.
    uow.projects.save(project.model_copy(update={"status": "ready", "public": True, "public_slug": PORTAL_SLUG}))
    uow.commit()


def main() -> None:
    with TestClient(app) as client:
        ana, leo = ACCOUNTS
        results = {a["email"]: sign_in_or_up(client, a) for a in ACCOUNTS}

        sign_in_or_up(client, ana)
        projects = _check(client.get("/api/projects"), "Listing Ana's projects")
        project = next((p for p in projects if p["name"] == PROJECT["name"]), None)
        if project is None:
            project = _check(client.post("/api/projects", json=PROJECT), "Creating the demo project")
            token = _check(client.get(f"/api/projects/{project['id']}/invitation"), "Reading the invitation")["token"]
            sign_in_or_up(client, leo)
            _check(client.post(f"/api/invitations/{token}/join", json={}), "Leo joining the project")
            project_state = "created, Leo joined with the link"
        else:
            project_state = "already there"

        # Filled once: a budget means the story is already in. Done apart from the project's creation,
        # so a run that stopped halfway fills it on the next one.
        with open_uow() as uow:
            if uow.budgets.get(project["id"]) is None:
                fill_mangrove_project(uow, project["id"])
                project_state += "; board, budget, evidence and portal loaded"

    print("Demo accounts (password for both: %s)" % PASSWORD)
    for account in ACCOUNTS:
        print(f"  {account['email']:<16} {account['name']:<10} {results[account['email']]}")
    print(f"Project '{PROJECT['name']}' (id {project['id']}): {project_state}")
    print("Ana is its leader, Leo a member. Sign in at http://localhost:5173/login")
    print(f"Public portal: http://localhost:5174/p/{PORTAL_SLUG}")


if __name__ == "__main__":
    main()
