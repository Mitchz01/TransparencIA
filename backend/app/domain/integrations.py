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
    # Issues the PR closes ("Closes #12").
    closes: list[int] = []


class ExternalLink(BaseModel):
    """Task ↔ issue/PR link. Our board is the source of truth:
    only state changes come in from GitHub."""

    id: int | None = None
    task_id: int
    kind: ExternalKind
    number: int
    url: str
    state: ExternalState = "open"
