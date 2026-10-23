"""UC-03 · Start or resume planning (spec 002, FR-013 and FR-016).

Runs in the request: it checks the project can plan, sets it to `planning` and picks the
first stage without an approved proposal, so after an error it resumes instead of starting
over (US5). The router then spawns RunPlanningStep for that stage."""

from app.application.dto import StageRun
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.planning.context import approved_outputs, rejection_feedback, stage_history
from app.domain.errors import PlanningAlreadyRunning, PlanningNotStartable, ProjectNotFound
from app.domain.plan import first_pending_stage


class StartPlanning:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> StageRun:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        if project.status == "planning":
            raise PlanningAlreadyRunning(project_id)
        proposals = self._uow.proposals.list_by_project(project_id)
        stage = first_pending_stage(approved_outputs(proposals))
        if project.status == "ready" or stage is None:
            raise PlanningNotStartable(project_id, project.status)

        self._uow.projects.save(project.model_copy(update={"status": "planning"}))
        self._uow.commit()

        history = stage_history(proposals, stage.key)
        latest = history[0] if history else None
        if latest is not None and latest.status == "pending":
            # Its proposal is already waiting for the leader: running the agent again would duplicate it.
            return StageRun(project_id=project_id, stage=stage.key, run=False)
        # A redo that failed resumes with the leader's last rejection reason.
        feedback = rejection_feedback(latest) if latest is not None and latest.status == "rejected" else None
        return StageRun(project_id=project_id, stage=stage.key, feedback=feedback)
