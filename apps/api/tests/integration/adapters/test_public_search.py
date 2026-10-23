"""GET /api/public/projects (spec 017, US8): the portal's home lists and searches the published projects."""

from tests.api import create_project
from tests.integration.adapters.test_transparency_api import BUDGET, PROJECT, _publish, agents, budgeted, pid  # noqa: F401


def test_lists_only_published_projects_with_their_numbers(client, anonymous, budgeted):
    other = create_project(client, {**PROJECT, "name": "Vía terciaria en Aracataca"})["id"]
    client.put(f"/api/projects/{other}/budget", json={**BUDGET, "contracting_entity": "Gobernación del Magdalena"})
    assert anonymous.get("/api/public/projects").json() == []

    slug = _publish(client, budgeted)
    [card] = anonymous.get("/api/public/projects").json()
    assert card["slug"] == slug and card["name"] == PROJECT["name"]
    assert card["contracting_entity"] == "Corpamag" and card["contract_value"] == 180_000_000
    assert card["light"] in ("green", "yellow", "red") and card["spent_pct"] == 0 and card["open_alerts"] == 0


def test_searches_ignoring_case_and_accents(client, anonymous, budgeted):
    _publish(client, budgeted)
    other = create_project(client, {**PROJECT, "name": "Vía terciaria en Aracataca", "description": "Pavimentación."})["id"]
    client.put(f"/api/projects/{other}/budget", json={**BUDGET, "contracting_entity": "Gobernación del Magdalena"})
    _publish(client, other)

    names = lambda q: [card["name"] for card in anonymous.get("/api/public/projects", params={"q": q}).json()]  # noqa: E731
    assert names("") == ["Restauración de manglar en la Ciénaga Grande", "Vía terciaria en Aracataca"]
    assert names("CIENAGA") == ["Restauración de manglar en la Ciénaga Grande"]
    assert names("gobernacion") == ["Vía terciaria en Aracataca"]
    assert names("manglar corpamag") == ["Restauración de manglar en la Ciénaga Grande"]
    assert names("puente") == []


def test_rejects_a_query_too_long(anonymous):
    response = anonymous.get("/api/public/projects", params={"q": "x" * 101})
    assert response.status_code == 422 and response.json()["code"] == "validation_failed"
