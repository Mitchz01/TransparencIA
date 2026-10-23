"""/api/projects/{id}/budget, /expenses, /transparency, /publication, /alerts and /api/files/{id}
(spec 017, plan.md "API Contract"). Owner: P3."""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["transparency"])
