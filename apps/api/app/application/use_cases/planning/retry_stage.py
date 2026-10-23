"""Rerun a capped stage (spec 002, US4, FR-011).

After MAX_CONSECUTIVE_REJECTIONS rejections in a row a stage isn't redone by itself: the
leader either adjusts the last proposal (spec 005) or asks for one more try here. Runs in the
request; the router spawns RunPlanningStep with the last rejection as feedback."""

from app.application.dto import StageRun
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.planning.context import rejection_feedback, stage_history
from app.domain.errors import ProjectNotFound, StageNotRetryable
from app.domain.plan import stage_by_key
from app.domain.proposals import MAX_CONSECUTIVE_REJECTIONS, consecutive_rejections


class RetryStage:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, stage_key: str) -> StageRun:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        stage = stage_by_key(stage_key)
        history = stage_history(self._uow.proposals.list_by_project(project_id), stage.key)
        latest = history[0] if history else None
        # Waiting for the leader = the newest proposal is the capped rejection. Anything else
        # (running, pending approval, approved) isn't retried here.
        if latest is None or latest.status != "rejected" or consecutive_rejections(history) < MAX_CONSECUTIVE_REJECTIONS:
            raise StageNotRetryable(stage.key)
        if project.status != "planning":
            self._uow.projects.save(project.model_copy(update={"status": "planning"}))
            self._uow.commit()
        return StageRun(project_id=project_id, stage=stage.key, feedback=rejection_feedback(latest))
