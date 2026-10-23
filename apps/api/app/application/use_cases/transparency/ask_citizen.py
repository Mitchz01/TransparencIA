"""A citizen's question, answered only from the public portal's data (spec 017, US4). Owner: P2."""

from app.application.ports.transparency_agents import TransparencyAgents
from app.application.use_cases.transparency.get_portal import GetPortal
from app.domain.transparency import CitizenAnswer


class AskCitizen:
    def __init__(self, get_portal: GetPortal, agents: TransparencyAgents):
        self._get_portal = get_portal
        self._agents = agents

    async def execute(self, slug: str, question: str) -> CitizenAnswer:
        raise NotImplementedError
