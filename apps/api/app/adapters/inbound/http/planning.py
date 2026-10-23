"""/api/projects/{id}/planning (spec 002, UC-03). Progress arrives over the SSE stream
(GET /api/projects/{id}/events, spec 005); approving, adjusting and rejecting stage
proposals is spec 005's API."""

from fastapi import APIRouter, Depends, status

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.background import spawn
from app.application.dto import PlanningAccepted, ReplanAccepted, ReplanRequest, StageRun
from app.application.use_cases.planning.replan import Replan
from app.application.use_cases.planning.retry_stage import RetryStage
from app.application.use_cases.planning.run_planning_step import RunPlanningStep
from app.application.use_cases.planning.start_planning import StartPlanning

router = APIRouter(prefix="/api/projects", tags=["planning"])


def _accept(run: StageRun, run_step: RunPlanningStep) -> PlanningAccepted:
    if run.run:
        spawn(run_step.execute(run.project_id, run.stage, run.feedback))  # agents never run inside the request
    return PlanningAccepted(project_id=run.project_id, stage=run.stage)


@router.post("/{project_id}/planning", status_code=status.HTTP_202_ACCEPTED, response_model=PlanningAccepted, dependencies=[Depends(deps.allow("manage"))])
async def start_planning(
    project_id: int,
    use_case: StartPlanning = Depends(deps.get_start_planning),
    run_step: RunPlanningStep = Depends(deps.get_run_planning_step),
) -> PlanningAccepted:
    return _accept(use_case.execute(project_id), run_step)


@router.post(
    "/{project_id}/planning/stages/{stage_key}/retry",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=PlanningAccepted,
    dependencies=[Depends(deps.allow("manage"))],
)
async def retry_stage(
    project_id: int,
    stage_key: str,
    use_case: RetryStage = Depends(deps.get_retry_stage),
    run_step: RunPlanningStep = Depends(deps.get_run_planning_step),
) -> PlanningAccepted:
    return _accept(use_case.execute(project_id, stage_key), run_step)


@router.post("/{project_id}/replan", status_code=status.HTTP_202_ACCEPTED, response_model=ReplanAccepted, dependencies=[Depends(deps.allow("manage"))])
async def replan(project_id: int, body: ReplanRequest, use_case: Replan = Depends(deps.get_replan)) -> ReplanAccepted:
    """Spec 008 (US2): the result arrives as a `replan` proposal, decided through spec 005's API."""
    run = use_case.prepare(project_id, body.reason)
    spawn(use_case.execute(run))  # agents never run inside the request
    return ReplanAccepted(project_id=project_id, supersedes=run.supersedes)
