import asyncio

from app.adapters.outbound.agents.mock.agents import MockPlanningAgents
from app.application.use_cases.planning.run_planning import RunPlanning
from app.domain.events import AgentFinished, AgentStarted
from app.domain.plan import PLANNING_STAGES
from app.domain.project import Member, Project

PROJECT = Project(id=1, name="Demo", description="Something", members=[Member(id=7, name="Ana", role="Backend")])


class RecordingAgents(MockPlanningAgents):
    def __init__(self):
        super().__init__(delay_seconds=0)
        self.contexts: dict[str, dict] = {}

    async def run_stage(self, stage, context):
        self.contexts[stage.key] = context
        return await super().run_stage(stage, context)


async def _collect(use_case):
    return [event async for event in use_case(PROJECT)]


def test_runs_every_stage_in_order():
    events = asyncio.run(_collect(RunPlanning(RecordingAgents())))

    started = [e.agent for e in events if isinstance(e, AgentStarted)]
    finished = [e.agent for e in events if isinstance(e, AgentFinished)]
    expected = [stage.key for stage in PLANNING_STAGES]
    assert started == expected
    assert finished == expected


def test_each_stage_only_receives_its_inputs():
    agents = RecordingAgents()
    asyncio.run(_collect(RunPlanning(agents)))

    for stage in PLANNING_STAGES:
        assert set(agents.contexts[stage.key]) == set(stage.inputs)
    assert agents.contexts["methodology"]["analysis"]["complexity"] == "medium"


def test_agents_only_see_project_inputs():
    agents = RecordingAgents()
    asyncio.run(_collect(RunPlanning(agents)))

    project = agents.contexts["analysis"]["project"]
    assert "id" not in project and "status" not in project
    assert project["members"] == [
        {"name": "Ana", "role": "Backend", "seniority": "mid", "hours_per_week": 20, "skills": []}
    ]
