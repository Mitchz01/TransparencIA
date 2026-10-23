from typing import Literal

from pydantic import BaseModel

ExternalKind = Literal["issue", "pull_request"]
ExternalState = Literal["open", "closed", "merged"]


class IssueRef(BaseModel):
    number: int
    url: str
    state: ExternalState = "open"


class PullRequestRef(BaseModel):
    number: int
    url: str
    state: ExternalState = "open"
    # Issues que cierra el PR ("Closes #12").
    closes: list[int] = []


class ExternalLink(BaseModel):
    """Vínculo tarea ↔ issue/PR. Nuestro tablero es la fuente de verdad:
    desde GitHub sólo entran cambios de estado."""

    id: int | None = None
    task_id: int
    kind: ExternalKind
    number: int
    url: str
    state: ExternalState = "open"
