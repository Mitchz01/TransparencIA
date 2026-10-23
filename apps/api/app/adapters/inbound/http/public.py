"""/api/public/projects/{slug}: the portal and the citizen chat, no session (spec 017, US3 and US4). Owner: P3."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/public", tags=["public"])
