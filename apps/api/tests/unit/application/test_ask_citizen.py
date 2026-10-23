"""Spec 017, US4: a citizen's question is answered only from what the public portal already shows."""

import asyncio
import datetime as dt
from typing import Any

import pytest

from app.application.use_cases.transparency.ask_citizen import AskCitizen
from app.domain.errors import ProjectNotFound
from app.domain.transparency import CitizenAnswer, Portal, PortalProject, Summary

PORTAL = Portal(
    project=PortalProject(
        name="Restauración de manglar en la Ciénaga Grande",
        description="Restauración de 5 ha de manglar.",
        contracting_entity="Corpamag",
        contractor="Fundación Manglares Vivos",
        contract_value=180_000_000,
        start_date=dt.date(2026, 8, 3),
        end_date=dt.date(2027, 2, 1),
    ),
    summary=Summary(spent=32_400_000, spent_pct=18.0, physical_pct=20.0, time_pct=46.2, unallocated=0, light="green", reasons=[]),
    lines=[],
    timeline=[],
    sprints=[],
    expenses=[],
    alerts=[],
    public_url="https://example.org/p/manglar",
)


class _FakeGetPortal:
    """Stands in for `GetPortal`: AskCitizen only ever calls `for_public`."""

    def __init__(self, portal: Portal | None = PORTAL):
        self._portal = portal

    def for_public(self, slug: str) -> Portal:
        if self._portal is None:
            raise ProjectNotFound(slug)
        return self._portal


class _FakeAgents:
    """Stands in for `TransparencyAgents`: records what it was called with."""

    def __init__(self, answer: str = "La plata se gastó sobre todo en plántulas de mangle."):
        self._answer = answer
        self.calls: list[tuple[dict[str, Any], str]] = []

    async def read_evidence(self, context, file, mime, filename):  # pragma: no cover - unused here
        raise NotImplementedError

    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer:
        self.calls.append((portal, question))
        return CitizenAnswer(answer=self._answer)


def _ask(get_portal, agents, slug="manglar", question="¿En qué se gastó la plata?") -> CitizenAnswer:
    return asyncio.run(AskCitizen(get_portal, agents).execute(slug, question))


def test_it_answers_from_the_public_portal():
    agents = _FakeAgents()
    answer = _ask(_FakeGetPortal(), agents)
    assert answer.answer == agents._answer


def test_it_asks_the_agent_with_the_portal_as_json_and_the_question():
    agents = _FakeAgents()
    _ask(_FakeGetPortal(), agents, question="¿Cuánto cuesta el contrato?")
    [(portal_json, question)] = agents.calls
    assert portal_json["project"]["contract_value"] == 180_000_000
    assert portal_json["project"]["start_date"] == "2026-08-03"  # dates serialize as plain strings
    assert question == "¿Cuánto cuesta el contrato?"


def test_only_the_public_portal_reaches_the_agent_never_drafts_or_team_data():
    agents = _FakeAgents()
    _ask(_FakeGetPortal(), agents)
    [(portal_json, _)] = agents.calls
    assert "drafts" not in portal_json
    assert "public" not in portal_json  # the TeamPortal-only flag never leaks into what the model sees


def test_an_unknown_slug_raises_project_not_found_without_calling_the_agent():
    agents = _FakeAgents()
    with pytest.raises(ProjectNotFound):
        _ask(_FakeGetPortal(portal=None), agents)
    assert agents.calls == []
