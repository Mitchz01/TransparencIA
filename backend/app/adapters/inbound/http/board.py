"""/api/projects/{id}/board and /api/tasks/{id} (spec 003, UC-06)."""

from fastapi import APIRouter, Depends

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import BoardView
from app.application.use_cases.board.get_board import GetBoard

router = APIRouter(prefix="/api", tags=["board"])


@router.get("/projects/{project_id}/board", response_model=BoardView)
def get_board(project_id: int, use_case: GetBoard = Depends(deps.get_get_board)) -> BoardView:
    return use_case.execute(project_id)
