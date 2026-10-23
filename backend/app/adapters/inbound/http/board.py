"""/api/projects/{id}/board and /api/tasks/{id} (spec 003, UC-06)."""

from fastapi import APIRouter, Depends

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import BoardView, ChecklistUpdate, TaskMove, TaskResult, TaskUpdate
from app.application.use_cases.board.get_board import GetBoard
from app.application.use_cases.board.move_task import MoveTask
from app.application.use_cases.board.update_checklist import UpdateChecklist
from app.application.use_cases.board.update_task import UpdateTask

router = APIRouter(prefix="/api", tags=["board"])


@router.get("/projects/{project_id}/board", response_model=BoardView)
def get_board(project_id: int, use_case: GetBoard = Depends(deps.get_get_board)) -> BoardView:
    return use_case.execute(project_id)


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


@router.put("/tasks/{task_id}/checklist", response_model=TaskResult)
async def replace_checklist(
    task_id: int, body: ChecklistUpdate, use_case: UpdateChecklist = Depends(deps.get_update_checklist)
) -> TaskResult:
    return await use_case.execute(task_id, body.items)
