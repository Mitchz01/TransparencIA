from collections.abc import AsyncIterator
from typing import Protocol

from app.domain.entities import Member, Project
from app.domain.plan import PlanEvent


class PlanGenerator(Protocol):
    """Puerto de salida: genera el plan de un proyecto paso a paso.

    Emite `agent_started` y `agent_finished` por cada paso de `PLAN_STEPS`, en
    orden. El `output` de cada `agent_finished` cumple el esquema de su paso.
    """

    def generate(self, project: Project, members: list[Member]) -> AsyncIterator[PlanEvent]: ...
