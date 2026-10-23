"""Project plan: the planning stages and the output schema of each one.
The agents use them as output_schema, so the result arrives as validated
JSON and can be persisted directly."""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["low", "medium", "high"]


# ---------- Product analyst ----------


class Risk(BaseModel):
    description: str
    impact: Level
    mitigation: str


class Analysis(BaseModel):
    summary: str = Field(description="Project summary in 2-3 sentences")
    goals: list[str]
    in_scope: list[str]
    out_of_scope: list[str]
    risks: list[Risk]
    complexity: Level
    team_gaps: list[str] = Field(description="Roles or skills the team is missing")


# ---------- Agile coach ----------


class Ceremony(BaseModel):
    name: str
    frequency: str
    purpose: str


class WipLimit(BaseModel):
    column: Literal["todo", "in_progress", "review"]
    limit: int


class Alternative(BaseModel):
    methodology: str
    why_not: str


class MethodologyDecision(BaseModel):
    methodology: Literal["scrum", "kanban", "scrumban", "xp", "shape_up"]
    rationale: str
    sprint_length_weeks: int = Field(description="Length of each iteration in weeks (1-4)")
    ceremonies: list[Ceremony]
    wip_limits: list[WipLimit]
    alternatives: list[Alternative]


# ---------- Software architect ----------


class Component(BaseModel):
    name: str
    responsibility: str
    technology: str


class StackItem(BaseModel):
    layer: str
    technology: str
    reason: str


class ArchitectureDecision(BaseModel):
    title: str
    decision: str
    rationale: str


class Architecture(BaseModel):
    style: str = Field(description="E.g. modular monolith, microservices, serverless")
    summary: str
    components: list[Component]
    stack: list[StackItem]
    decisions: list[ArchitectureDecision]


# ---------- Roadmap ----------


class Epic(BaseModel):
    key: str = Field(description="Short identifier, e.g. EP-1")
    title: str
    description: str


class Phase(BaseModel):
    name: str
    goal: str
    start_week: int
    end_week: int
    deliverables: list[str]
    epics: list[Epic]


class Roadmap(BaseModel):
    phases: list[Phase]


# ---------- Backlog ----------


class Story(BaseModel):
    key: str = Field(description="Short identifier, e.g. US-1")
    epic_key: str
    title: str
    description: str
    acceptance_criteria: list[str]
    type: Literal["feature", "bug", "chore", "spike"]
    points: int = Field(description="Story points in Fibonacci: 1, 2, 3, 5, 8, 13")
    priority: Level
    role: str = Field(description="Team role best suited for the story")


class Backlog(BaseModel):
    stories: list[Story]


# ---------- Sprint planner ----------


class SprintPlan(BaseModel):
    number: int
    name: str
    goal: str
    phase: str
    story_keys: list[str]


class Assignment(BaseModel):
    story_key: str
    member_name: str


class SprintPlanning(BaseModel):
    sprints: list[SprintPlan]
    assignments: list[Assignment]


# ---------- Stages ----------


@dataclass(frozen=True)
class PlanningStage:
    key: str  # key of the result in the plan context
    title: str  # agent name shown to the user
    schema: type[BaseModel]
    inputs: tuple[str, ...]  # previous results it needs as context


PLANNING_STAGES: tuple[PlanningStage, ...] = (
    PlanningStage("analysis", "Product analyst", Analysis, ("project",)),
    PlanningStage("methodology", "Agile coach", MethodologyDecision, ("project", "analysis")),
    PlanningStage("architecture", "Software architect", Architecture, ("project", "analysis", "methodology")),
    PlanningStage("roadmap", "Product manager", Roadmap, ("project", "analysis", "methodology", "architecture")),
    PlanningStage("backlog", "Product owner", Backlog, ("project", "architecture", "roadmap")),
    PlanningStage("sprints", "Scrum master", SprintPlanning, ("project", "methodology", "roadmap", "backlog")),
)
