"""Esquemas de salida de cada agente. Gemini los usa como response_schema,
así que el resultado llega como JSON validado y se puede persistir directo."""

from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["low", "medium", "high"]


# ---------- Analista ----------


class Risk(BaseModel):
    description: str
    impact: Level
    mitigation: str


class Analysis(BaseModel):
    summary: str = Field(description="Resumen del proyecto en 2-3 oraciones")
    goals: list[str]
    in_scope: list[str]
    out_of_scope: list[str]
    risks: list[Risk]
    complexity: Level
    team_gaps: list[str] = Field(description="Roles o skills que le faltan al equipo")


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
    sprint_length_weeks: int = Field(description="Duración de cada iteración en semanas (1-4)")
    ceremonies: list[Ceremony]
    wip_limits: list[WipLimit]
    alternatives: list[Alternative]


# ---------- Arquitecto ----------


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
    style: str = Field(description="Ej: monolito modular, microservicios, serverless")
    summary: str
    components: list[Component]
    stack: list[StackItem]
    decisions: list[ArchitectureDecision]


# ---------- Roadmap ----------


class Epic(BaseModel):
    key: str = Field(description="Identificador corto, ej: EP-1")
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
    key: str = Field(description="Identificador corto, ej: US-1")
    epic_key: str
    title: str
    description: str
    acceptance_criteria: list[str]
    type: Literal["feature", "bug", "chore", "spike"]
    points: int = Field(description="Story points en Fibonacci: 1, 2, 3, 5, 8, 13")
    priority: Level
    role: str = Field(description="Rol del equipo más adecuado para la historia")


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
