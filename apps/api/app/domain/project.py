from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, get_args

from pydantic import BaseModel, Field, computed_field

from app.domain.errors import FieldError, MethodologyLocked, ValidationFailed

ProjectStatus = Literal["draft", "planning", "ready", "error"]
RequestedMethodology = Literal["auto", "scrum", "kanban", "scrumban", "xp", "shape_up"]
Seniority = Literal["junior", "mid", "senior"]
# What a member can do in a project (spec 015, US5): leaders do everything, members do the work.
Permission = Literal["leader", "member"]

# Spec 001, FR-004 (limits from the API contract in plan.md).
NAME_MAX = 120
DESCRIPTION_MAX = 5000
ROLE_MAX = 60
SKILL_MAX = 40
WEEKS_RANGE = (1, 52)
HOURS_RANGE = (1, 60)

# Member fields whose change is reported in TeamChanged.
MEMBER_FIELDS = ("name", "role", "seniority", "hours_per_week", "skills")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Member(BaseModel):
    id: int | None = None
    name: str
    role: str
    seniority: Seniority = "mid"
    hours_per_week: int = 20
    skills: list[str] = []
    # Set only from Integrations (spec 007, US3): issues are assigned and reviews requested to it.
    github_username: str | None = None
    # Spec 015: the account this member is (None only for members made before accounts) and
    # what they can do. Changing `permission` isn't a team change (it's not in MEMBER_FIELDS).
    account_id: int | None = None
    permission: Permission = "member"
    # The account's photo (FR-005): it follows the profile, like the name, but isn't a team change.
    avatar_url: str | None = None


class Project(BaseModel):
    id: int | None = None
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: RequestedMethodology = "auto"
    status: ProjectStatus = "draft"
    # When on, the agents' proposals are approved automatically (they're still audited).
    auto_approve: bool = False
    # Connected GitHub repo, "owner/name" format. Only one per project.
    repository: str | None = None
    # approved stage outputs keyed by stage (spec 002)
    plan: dict[str, Any] | None = None
    # Fixed points per sprint set by the leader; None = estimated from the team (spec 003, FR-017).
    sprint_capacity_override: int | None = None
    members: list[Member] = []
    created_at: datetime = Field(default_factory=_now)
    # The project's own GitHub token (spec 007, FR-004). Write-only: never serialized, so it
    # can't leak through the API or events; the API exposes `has_token` instead.
    github_token: str | None = Field(default=None, exclude=True)
    # Id of the webhook registered on `repository`, to delete it on disconnect (spec 007).
    webhook_id: int | None = Field(default=None, exclude=True)
    # Spec 015: the current invitation link's token; None = invitations off. Only leaders read it
    # (GET /invitation), so it's never serialized with the project.
    invite_token: str | None = Field(default=None, exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_token(self) -> bool:
        return bool(self.github_token)


# ---------- Normalization and validation (spec 001, FR-004) ----------


def normalize_name(value: str) -> str:
    """Trim and collapse inner whitespace: '  Ana   Gómez ' -> 'Ana Gómez'."""
    return " ".join(value.split())


def normalize_skills(skills: list[str]) -> list[str]:
    """Trimmed, without empty entries and without case-insensitive duplicates (first one wins)."""
    seen: set[str] = set()
    result: list[str] = []
    for skill in skills:
        clean = normalize_name(skill)
        if clean and clean.casefold() not in seen:
            seen.add(clean.casefold())
            result.append(clean)
    return result


def normalize_member(member: Member) -> Member:
    return member.model_copy(
        update={
            "name": normalize_name(member.name),
            "role": normalize_name(member.role),
            "skills": normalize_skills(member.skills),
        }
    )


def normalize_project(project: Project) -> Project:
    return project.model_copy(
        update={
            "name": normalize_name(project.name),
            "description": project.description.strip(),
            "members": [normalize_member(m) for m in project.members],
        }
    )


def _check_text(errors: list[FieldError], path: str, value: str, max_len: int) -> None:
    if not value:
        errors.append(FieldError(path, "Required."))
    elif len(value) > max_len:
        errors.append(FieldError(path, f"Max {max_len} characters."))


def _check_range(errors: list[FieldError], path: str, value: int, bounds: tuple[int, int]) -> None:
    low, high = bounds
    if not low <= value <= high:
        errors.append(FieldError(path, f"Must be between {low} and {high}."))


def project_errors(project: Project) -> list[FieldError]:
    """Every FR-004 rule that fails, for an already normalized project."""
    errors: list[FieldError] = []
    _check_text(errors, "name", project.name, NAME_MAX)
    _check_text(errors, "description", project.description, DESCRIPTION_MAX)
    _check_range(errors, "duration_weeks", project.duration_weeks, WEEKS_RANGE)
    if project.requested_methodology not in get_args(RequestedMethodology):
        errors.append(FieldError("requested_methodology", "Must be one of: " + ", ".join(get_args(RequestedMethodology)) + "."))

    if not project.members:
        errors.append(FieldError("members", "The team needs at least one member."))
    seen_names: set[str] = set()
    for i, member in enumerate(project.members):
        path = f"members[{i}]"
        _check_text(errors, f"{path}.name", member.name, NAME_MAX)
        if member.name:
            key = member.name.casefold()
            if key in seen_names:
                errors.append(FieldError(f"{path}.name", "Duplicated name."))
            seen_names.add(key)
        _check_text(errors, f"{path}.role", member.role, ROLE_MAX)
        _check_range(errors, f"{path}.hours_per_week", member.hours_per_week, HOURS_RANGE)
        for j, skill in enumerate(member.skills):
            if len(skill) > SKILL_MAX:
                errors.append(FieldError(f"{path}.skills[{j}]", f"Max {SKILL_MAX} characters."))
    return errors


def validate_project(project: Project) -> Project:
    """Normalizes the project and raises ValidationFailed with every failing field."""
    normalized = normalize_project(project)
    errors = project_errors(normalized)
    if errors:
        raise ValidationFailed(errors, "The project has invalid fields.")
    return normalized


# ---------- Team changes (spec 001, US4) ----------


@dataclass(frozen=True)
class MemberChange:
    member_id: int
    name: str
    fields: list[str]


@dataclass(frozen=True)
class TeamDiff:
    joined: list[str] = field(default_factory=list)  # names
    left: list[str] = field(default_factory=list)
    changed: list[MemberChange] = field(default_factory=list)
    left_ids: list[int] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not (self.joined or self.left or self.changed)


def diff_team(old: list[Member], new: list[Member]) -> TeamDiff:
    """Members are matched by id; members without id are new."""
    old_by_id = {m.id: m for m in old if m.id is not None}
    new_ids = {m.id for m in new if m.id is not None}
    joined = [m.name for m in new if m.id is None or m.id not in old_by_id]
    left_members = [m for m in old if m.id not in new_ids]
    changed: list[MemberChange] = []
    for member in new:
        before = old_by_id.get(member.id) if member.id is not None else None
        if before is None:
            continue
        fields = [f for f in MEMBER_FIELDS if getattr(before, f) != getattr(member, f)]
        if fields:
            changed.append(MemberChange(member.id, member.name, fields))  # type: ignore[arg-type]
    return TeamDiff(
        joined=joined,
        left=[m.name for m in left_members],
        changed=changed,
        left_ids=[m.id for m in left_members if m.id is not None],
    )


@dataclass
class MemberPatch:
    """One item of the new team in an edit: `id` set = edit that member, None = new member.
    `values` only carries the fields the client sent."""

    id: int | None
    values: dict[str, Any]


@dataclass
class ProjectChanges:
    """Fields sent in an edit (PATCH). `members`, when not None, is the whole new team."""

    values: dict[str, Any] = field(default_factory=dict)
    members: list[MemberPatch] | None = None


NULLABLE_PROJECT_FIELDS: frozenset[str] = frozenset()


def apply_update(project: Project, changes: ProjectChanges) -> tuple[Project, TeamDiff]:
    """Returns the edited, validated project and what changed in its team.
    Raises ValidationFailed (every failing field) or MethodologyLocked; never mutates `project`."""
    errors: list[FieldError] = []
    if not changes.values and changes.members is None:
        raise ValidationFailed.single("", "No fields to update.")

    for name, value in changes.values.items():
        if value is None and name not in NULLABLE_PROJECT_FIELDS:
            errors.append(FieldError(name, "Required."))

    members = project.members
    if changes.members is not None:
        current = {m.id: m for m in project.members}
        members = []
        for i, patch in enumerate(changes.members):
            values = {k: v for k, v in patch.values.items() if k != "id"}
            for name, value in values.items():
                if value is None:
                    errors.append(FieldError(f"members[{i}].{name}", "Required."))
            values = {k: v for k, v in values.items() if v is not None}
            if patch.id is None:
                members.append(Member(**{"name": "", "role": "", **values}))
            elif patch.id not in current:
                errors.append(FieldError(f"members[{i}].id", "Unknown member."))
            else:
                members.append(current[patch.id].model_copy(update=values))

    values = {k: v for k, v in changes.values.items() if v is not None}
    edited = normalize_project(project.model_copy(update={**values, "members": members}))
    errors.extend(project_errors(edited))
    if errors:
        raise ValidationFailed(errors, "The project has invalid fields.")

    if edited.requested_methodology != project.requested_methodology and project.status != "draft":
        raise MethodologyLocked()

    return edited, diff_team(project.members, edited.members)
