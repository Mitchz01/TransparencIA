"""The portal's home: the published projects, searchable (spec 017, US8). Owner: P5.
Each card comes from GetPortal.for_public, so its numbers are the same rules as the project's portal."""

import datetime as dt
import unicodedata

from pydantic import BaseModel

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.transparency.get_portal import GetPortal
from app.domain.errors import ProjectNotFound
from app.domain.transparency import Light

QUERY_MAX = 100


class PublicProjectCard(BaseModel):
    slug: str
    name: str
    description: str
    contracting_entity: str
    contractor: str
    contract_value: int
    start_date: dt.date
    end_date: dt.date
    light: Light
    spent_pct: float
    physical_pct: float | None
    time_pct: float
    open_alerts: int


def _fold(text: str) -> str:
    """Lowercase without accents, so "cienaga" finds "Ciénaga"."""
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(c))


class SearchPublicProjects:
    def __init__(self, uow: UnitOfWork, get_portal: GetPortal):
        self._uow = uow
        self._get_portal = get_portal

    def execute(self, query: str = "") -> list[PublicProjectCard]:
        words = _fold(query).split()
        cards: list[PublicProjectCard] = []
        for project in self._uow.projects.list():
            if not project.public or not project.public_slug:
                continue
            try:
                portal = self._get_portal.for_public(project.public_slug)
            except ProjectNotFound:
                continue  # published without a budget: no portal to show
            p = portal.project
            haystack = _fold(" ".join([p.name, p.description, p.contracting_entity, p.contractor]))
            if not all(word in haystack for word in words):
                continue
            cards.append(
                PublicProjectCard(
                    slug=project.public_slug,
                    name=p.name,
                    description=p.description,
                    contracting_entity=p.contracting_entity,
                    contractor=p.contractor,
                    contract_value=p.contract_value,
                    start_date=p.start_date,
                    end_date=p.end_date,
                    light=portal.summary.light,
                    spent_pct=portal.summary.spent_pct,
                    physical_pct=portal.summary.physical_pct,
                    time_pct=portal.summary.time_pct,
                    open_alerts=sum(1 for alert in portal.alerts if alert.answer is None),
                )
            )
        return sorted(cards, key=lambda card: _fold(card.name))
