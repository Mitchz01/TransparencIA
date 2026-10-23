from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.errors import DomainError, NotFound, ProposalAlreadyResolved


def _status_for(error: DomainError) -> int:
    if isinstance(error, NotFound):
        return 404
    if isinstance(error, ProposalAlreadyResolved):
        return 409
    return 400


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(status_code=_status_for(error), content={"detail": str(error)})
