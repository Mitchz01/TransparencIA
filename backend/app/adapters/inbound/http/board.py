"""/api/projects/{id}/board and /api/tasks/{id} (spec 003, UC-06); /api/sprints/{id}/close (spec 008)."""

from fastapi import APIRouter, Depends

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import (
    BoardView,
    CapacityResult,
    CapacityUpdate,
    ChecklistUpdate,
    SprintCloseResult,
    TaskMove,
    TaskResult,
    TaskUpdate,
)
from app.application.use_cases.board.close_sprint import CloseSprint
from app.application.use_cases.board.get_board import GetBoard
from app.application.use_cases.board.move_task import MoveTask
from app.application.use_cases.board.set_capacity import SetCapacity
from app.application.use_cases.board.update_checklist import UpdateChecklist
from app.application.use_cases.board.update_task import UpdateTask

router = APIRouter(prefix="/api", tags=["board"])


@router.get("/projects/{project_id}/board", response_model=BoardView)
def get_board(project_id: int, use_case: GetBoard = Depends(deps.get_get_board)) -> BoardView:
    return use_case.execute(project_id)


@router.put("/projects/{project_id}/capacity", response_model=CapacityResult)
def set_capacity(
    project_id: int, body: CapacityUpdate, use_case: SetCapacity = Depends(deps.get_set_capacity)
) -> CapacityResult:
    return use_case.execute(project_id, body.points_per_sprint)


@router.patch("/tasks/{task_id}", response_model=TaskResult)
async def update_task(
    task_id: int,
    body: TaskUpdate,
    move_task: MoveTask = Depends(deps.get_move_task),
    edit_task: UpdateTask = Depends(deps.get_update_task),
) -> TaskResult:
    """Move fields, edit fields or both (saved together). Warnings never block."""
    edit, move = body.edit(), body.move()
    if edit is not None:
        return await edit_task.execute(task_id, edit, move)
    return await move_task.execute(task_id, move or TaskMove())  # an empty body is a 422


@router.post("/sprints/{sprint_id}/close", response_model=SprintCloseResult)
async def close_sprint(sprint_id: int, use_case: CloseSprint = Depends(deps.get_close_sprint)) -> SprintCloseResult:
    """Spec 008 (US4): with unfinished tasks, a replan is proposed in the background (never auto-approved)."""
    return await use_case.execute(sprint_id)


@router.put("/tasks/{task_id}/checklist", response_model=TaskResult)
async def replace_checklist(
    task_id: int, body: ChecklistUpdate, use_case: UpdateChecklist = Depends(deps.get_update_checklist)
) -> TaskResult:
    return await use_case.execute(task_id, body.items)
