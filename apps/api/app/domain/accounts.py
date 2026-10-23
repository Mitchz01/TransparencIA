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

# ---------- Who registers projects (spec 020): a natural or a legal person, as Colombian rules ask ----------

PersonType = Literal["natural", "juridica"]
# CC cédula de ciudadanía, CE cédula de extranjería, PPT permiso por protección temporal, PA pasaporte.
PersonDocument = Literal["CC", "CE", "PPT", "PA"]
DocumentType = Literal["CC", "CE", "PPT", "PA", "NIT"]
# Pública, privada, or entidad sin ánimo de lucro (ESAL).
EntityNature = Literal["publica", "privada", "esal"]

TEXT_MAX = 120
PLACE_MAX = 80
PHONE_DIGITS = (7, 15)
# DIAN's weights for the NIT check digit, from the rightmost digit.
_NIT_WEIGHTS = (3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71)
_LEGAL_PERSON_FIELDS = (
    "verification_digit", "entity_nature", "legal_rep_name", "legal_rep_document_type", "legal_rep_document_number",
)

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
    # Spec 020: the identification of a natural or legal person. All optional: an account without a
    # person type has an incomplete profile. `name` is the full name or the legal name (razón social).
    person_type: PersonType | None = None
    document_type: DocumentType | None = None
    document_number: str | None = None
    verification_digit: str | None = None  # NIT only
    entity_nature: EntityNature | None = None  # legal person only
    legal_rep_name: str | None = None
    legal_rep_document_type: PersonDocument | None = None
    legal_rep_document_number: str | None = None
    phone: str | None = None
    address: str | None = None
    municipality: str | None = None
    department: str | None = None
    data_consent_at: datetime | None = None  # Ley 1581 de 2012: when the person authorized it
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


def _text(value: str | None) -> str | None:
    clean = normalize_name(value) if value is not None else ""
    return clean or None


def _digits(value: str | None) -> str | None:
    clean = re.sub(r"\D", "", value or "")
    return clean or None


def _document(value: str | None) -> str | None:
    """Letters and digits only, upper case: '1.020.304.050' -> '1020304050', 'ab 12' -> 'AB12'."""
    clean = re.sub(r"[^0-9A-Za-z]", "", value or "").upper()
    return clean or None


def nit_check_digit(nit: str) -> str:
    """DIAN's check digit (dígito de verificación) of a NIT: 900123456 -> '8', 800197268 -> '4'."""
    total = sum(int(d) * _NIT_WEIGHTS[i] for i, d in enumerate(reversed(nit)))
    rest = total % 11
    return str(rest if rest < 2 else 11 - rest)


def normalize_profile(account: Account) -> Account:
    role = normalize_name(account.role) if account.role is not None else None
    avatar_url = account.avatar_url.strip() if account.avatar_url is not None else None
    update: dict[str, object] = {
        "name": normalize_name(account.name),
        "role": role or None,
        "skills": normalize_skills(account.skills),
        "avatar_url": avatar_url or None,
        "legal_rep_name": _text(account.legal_rep_name),
        "address": _text(account.address),
        "municipality": _text(account.municipality),
        "department": _text(account.department),
        "phone": _digits(account.phone),
        "legal_rep_document_number": _document(account.legal_rep_document_number),
        "verification_digit": _digits(account.verification_digit),
    }
    if account.person_type == "juridica":
        # A NIT typed as "900.123.456-8" carries its check digit after the dash.
        raw = account.document_number or ""
        if "-" in raw and not account.verification_digit:
            raw, _, digit = raw.rpartition("-")
            update["verification_digit"] = _digits(digit)
        update["document_number"] = _digits(raw)
        update["document_type"] = "NIT"
    else:
        update["document_number"] = _document(account.document_number)
    if account.person_type == "natural":
        update.update({field: None for field in _LEGAL_PERSON_FIELDS})
    return account.model_copy(update=update)


def _check_document(errors: list[FieldError], field: str, kind: str | None, number: str | None) -> None:
    if kind is None:
        errors.append(FieldError(field.replace("number", "type"), "Required."))
    if number is None:
        errors.append(FieldError(field, "Required."))
    elif kind == "CC" and not (number.isdigit() and 3 <= len(number) <= 10):
        errors.append(FieldError(field, "A cédula de ciudadanía has 3 to 10 digits."))
    elif not 3 <= len(number) <= 15:
        errors.append(FieldError(field, "Between 3 and 15 letters or digits."))


def _identification_errors(account: Account) -> list[FieldError]:
    """What a natural or legal person must give (spec 020, FR-002, FR-003, FR-005); nothing without a type."""
    errors: list[FieldError] = []
    if account.person_type is None:
        return errors
    if account.person_type == "natural":
        if account.document_type == "NIT":
            errors.append(FieldError("document_type", "A natural person uses CC, CE, PPT or PA."))
        else:
            _check_document(errors, "document_number", account.document_type, account.document_number)
    else:
        nit = account.document_number
        if nit is None:
            errors.append(FieldError("document_number", "Required."))
        elif not 8 <= len(nit) <= 10:
            errors.append(FieldError("document_number", "A NIT has 8 to 10 digits, without the check digit."))
        elif account.verification_digit is None:
            errors.append(FieldError("verification_digit", "Required."))
        elif account.verification_digit != nit_check_digit(nit):
            errors.append(FieldError("verification_digit", "The check digit doesn't match the NIT."))
        if account.entity_nature is None:
            errors.append(FieldError("entity_nature", "Required."))
        if account.legal_rep_name is None:
            errors.append(FieldError("legal_rep_name", "Required."))
        elif len(account.legal_rep_name) > NAME_MAX:
            errors.append(FieldError("legal_rep_name", f"Max {NAME_MAX} characters."))
        _check_document(errors, "legal_rep_document_number", account.legal_rep_document_type, account.legal_rep_document_number)
    low, high = PHONE_DIGITS
    if account.phone is None:
        errors.append(FieldError("phone", "Required."))
    elif not low <= len(account.phone) <= high:
        errors.append(FieldError("phone", f"Between {low} and {high} digits."))
    for field, limit in (("address", TEXT_MAX), ("municipality", PLACE_MAX), ("department", PLACE_MAX)):
        value = getattr(account, field)
        if value is None:
            errors.append(FieldError(field, "Required."))
        elif len(value) > limit:
            errors.append(FieldError(field, f"Max {limit} characters."))
    if account.data_consent_at is None:
        errors.append(FieldError("data_consent", "The personal data authorization is required (Ley 1581 de 2012)."))
    return errors


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
    errors.extend(_identification_errors(account))
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
