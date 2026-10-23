"""Accounts, sessions and what each member can do in a project (spec 015). No I/O."""

import hashlib
import re
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.errors import FieldError, Forbidden, LastLeader, ProjectNotFound, ValidationFailed
from app.domain.integrations import validate_github_username
from app.domain.project import (
    HOURS_RANGE,
    NAME_MAX,
    ROLE_MAX,
    SKILL_MAX,
    Member,
    Permission,
    Project,
    Seniority,
    normalize_name,
    normalize_skills,
)

# view = every read; work = the board and documents; manage = everything else (spec 015, US5).
ProjectAction = Literal["view", "work", "manage"]

EMAIL_MAX = 254
PASSWORD_RANGE = (8, 128)
SESSION_DAYS = 30
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
AVATAR_URL_MAX = 500

_ALLOWED: dict[Permission, frozenset[ProjectAction]] = {
    "leader": frozenset({"view", "work", "manage"}),
    "member": frozenset({"view", "work"}),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Account(BaseModel):
    """A person who uses the app, with the profile every project they join copies (FR-005)."""

    id: int | None = None
    email: str
    name: str
    role: str | None = None
    seniority: Seniority = "mid"
    hours_per_week: int = 20
    skills: list[str] = []
    github_username: str | None = None
    # A link to the photo. There is no upload: only the demo accounts have one (FR-005).
    avatar_url: str | None = None
    created_at: datetime = Field(default_factory=_now)
    # Never serialized, so it can't leak through the API or events (FR-003).
    password_hash: str = Field(default="", exclude=True)


class AuthSession(BaseModel):
    """A signed in device. Only the token's digest is stored, never the token."""

    id: int | None = None
    account_id: int
    token_digest: str
    created_at: datetime = Field(default_factory=_now)
    expires_at: datetime

    def expired(self, now: datetime) -> bool:
        return now >= self.expires_at


def new_session(account_id: int, digest: str, now: datetime) -> AuthSession:
    return AuthSession(account_id=account_id, token_digest=digest, created_at=now, expires_at=now + timedelta(days=SESSION_DAYS))


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------- Validation (FR-001, FR-005) ----------


def normalize_email(value: str) -> str:
    """'  Ana@Team.dev ' -> 'ana@team.dev': one account per address, whatever the case."""
    return value.strip().lower()


def _check_name(errors: list[FieldError], name: str) -> None:
    if not name:
        errors.append(FieldError("name", "Required."))
    elif len(name) > NAME_MAX:
        errors.append(FieldError("name", f"Max {NAME_MAX} characters."))


def signup_errors(name: str, email: str, password: str) -> list[FieldError]:
    """Every failing field, for an already normalized name and email."""
    errors: list[FieldError] = []
    _check_name(errors, name)
    if not EMAIL_PATTERN.match(email):
        errors.append(FieldError("email", "Must be an email address."))
    elif len(email) > EMAIL_MAX:
        errors.append(FieldError("email", f"Max {EMAIL_MAX} characters."))
    low, high = PASSWORD_RANGE
    if not low <= len(password) <= high:
        errors.append(FieldError("password", f"Must be between {low} and {high} characters."))
    return errors


def normalize_profile(account: Account) -> Account:
    role = normalize_name(account.role) if account.role is not None else None
    avatar_url = account.avatar_url.strip() if account.avatar_url is not None else None
    return account.model_copy(
        update={
            "name": normalize_name(account.name),
            "role": role or None,
            "skills": normalize_skills(account.skills),
            "avatar_url": avatar_url or None,
        }
    )


def _valid_avatar_url(url: str) -> bool:
    """An https link, or a path on the app's own origin (the demo photos); never `//host`."""
    local = url.startswith("/") and not url.startswith("//")
    return len(url) <= AVATAR_URL_MAX and (url.startswith("https://") or local)


def validate_profile(account: Account) -> Account:
    """The normalized account, or ValidationFailed with every failing field (spec 001's member limits)."""
    account = normalize_profile(account)
    errors: list[FieldError] = []
    _check_name(errors, account.name)
    if account.role and len(account.role) > ROLE_MAX:
        errors.append(FieldError("role", f"Max {ROLE_MAX} characters."))
    low, high = HOURS_RANGE
    if not low <= account.hours_per_week <= high:
        errors.append(FieldError("hours_per_week", f"Must be between {low} and {high}."))
    for i, skill in enumerate(account.skills):
        if len(skill) > SKILL_MAX:
            errors.append(FieldError(f"skills[{i}]", f"Max {SKILL_MAX} characters."))
    if account.avatar_url and not _valid_avatar_url(account.avatar_url):
        errors.append(FieldError("avatar_url", f"Must be an https:// URL or a path starting with /, max {AVATAR_URL_MAX} characters."))
    try:
        account = account.model_copy(update={"github_username": validate_github_username(account.github_username)})
    except ValidationFailed as error:
        errors.extend(error.errors)
    if errors:
        raise ValidationFailed(errors, "The profile has invalid fields.")
    return account


def project_role(role: str | None, account: Account) -> str:
    """The role someone has in a project they create or join: the one they gave, else their
    profile's. Required (spec 015, edge cases: a member always has a role)."""
    chosen = normalize_name(role) if role is not None else ""
    chosen = chosen or account.role or ""
    if not chosen:
        raise ValidationFailed.single("role", "Required.")
    if len(chosen) > ROLE_MAX:
        raise ValidationFailed.single("role", f"Max {ROLE_MAX} characters.")
    return chosen


# ---------- Members from accounts ----------


def unique_name(name: str, taken: Iterable[str]) -> str:
    """`name`, or `name 2`, `name 3`… when someone in the project already has it (FR-011).
    Compared like spec 001: case and extra spaces ignored."""
    used = {normalize_name(t).casefold() for t in taken}
    candidate, n = name, 2
    while normalize_name(candidate).casefold() in used:
        candidate, n = f"{name} {n}", n + 1
    return candidate


def member_from_profile(account: Account, role: str, permission: Permission, taken_names: Iterable[str] = ()) -> Member:
    return Member(
        name=unique_name(account.name, taken_names),
        role=role,
        seniority=account.seniority,
        hours_per_week=account.hours_per_week,
        skills=list(account.skills),
        github_username=account.github_username,
        avatar_url=account.avatar_url,
        account_id=account.id,
        permission=permission,
    )


# ---------- Who can do what (US5) ----------


def can(permission: Permission, action: ProjectAction) -> bool:
    return action in _ALLOWED[permission]


def member_of(project: Project, account_id: int | None) -> Member | None:
    return next((m for m in project.members if account_id is not None and m.account_id == account_id), None)


def check_access(project: Project, account_id: int | None, action: ProjectAction) -> Member:
    """The caller's member in `project`. Outsiders get ProjectNotFound, like a missing project
    (FR-007); members doing a leader action get Forbidden (FR-012)."""
    member = member_of(project, account_id)
    if member is None:
        raise ProjectNotFound(project.id)
    if not can(member.permission, action):
        raise Forbidden()
    return member


def ensure_leader(members: Iterable[Member]) -> None:
    """A project always keeps at least one leader (FR-015)."""
    if not any(m.permission == "leader" for m in members):
        raise LastLeader()
