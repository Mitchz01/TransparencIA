# Implementation Plan: 015 · Accounts, invitations and project roles

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

Backend: accounts with a flat profile, scrypt password hashes behind a `PasswordHasher` port, opaque session tokens stored as SHA-256 digests and sent in an `HttpOnly` cookie, and an access check (`AuthorizeAccess`) that every project route runs as a FastAPI dependency before its use case. `Member` gains `account_id` and `permission`; projects gain an invitation token. Creating a project makes the creator its Leader; people join with `POST /api/invitations/{token}/join`; leaders edit and remove members through new `/members/{id}` endpoints that reuse spec 001's `apply_update`, so validation and the `team_changed` event stay the same. Frontend: a prompt in [frontend-prompt.md](frontend-prompt.md) for the screens, gateways and fakes.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript + React 19 (frontend)  
**Primary Dependencies**: FastAPI, SQLModel; no new packages (`hashlib.scrypt` and `secrets` are stdlib)  
**Storage**: SQLite: new `account` and `auth_session` tables; `member.account_id`, `member.permission`, `project.invite_token`. `create_all` doesn't alter existing tables, so an old `agile.db` is detected at startup and the server asks to delete it (the spec starts from an empty database)  
**Testing**: pytest. Unit with `tests/fakes.py` (plus a fake hasher), integration with the API client signed in by the `client` fixture  
**Target Platform**: Cloud Run / local; the frontend reaches the API through Vite's `/api` proxy, so the cookie is same-origin  
**Project Type**: web (backend + frontend)  
**Performance Goals**: one extra indexed lookup per request (session digest) and one per project route (membership)  
**Constraints**: hexagonal layers (`tests/architecture/test_layers.py`); API conventions; nothing readable about passwords leaves the backend  
**Scale/Scope**: 2 tables, 3 columns, 14 endpoints, 12 use cases; every existing project route gets a guard

## Decisions

- **Cookie sessions, not JWT.** `EventSource` can't send an `Authorization` header, and the live activity (spec 005) is core. The cookie is `agile_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days, `Secure` when `COOKIE_SECURE=1`. The token is `secrets.token_urlsafe(32)`; only its SHA-256 digest is stored, so a leaked database doesn't leak sessions. Signing out deletes the row. Expired rows are deleted when seen and at startup.
- **CSRF**: `SameSite=Lax` keeps the cookie off cross-site `POST`/`PATCH`/`DELETE`, and every body must be `application/json` (cross-site JSON needs a CORS preflight, which only `CORS_ORIGINS` passes). CORS now sets `allow_credentials`.
- **Passwords: `hashlib.scrypt`** (n=2^14, r=8, p=1, 16-byte salt), stored as `scrypt$n$r$p$salt$hash`, compared with `hmac.compare_digest`. Behind `PasswordHasher` (`application/ports/security.py`), adapter in `adapters/outbound/security/`. Signing in with an unknown email still runs one verify against a dummy hash, so both failures take the same time and give the same `invalid_credentials`.
- **Authorization runs before the use case, as a dependency.** Guards live in `dependencies.py`: `current_account` (reads the cookie, runs `Authenticate`) and `allow(action, resource)`, which reads `{resource}_id` from the path and runs `AuthorizeAccess`. `AuthorizeAccess` maps the resource (project, task, sprint, proposal, document, member) to its project through the repos, and the domain's `check_access(project, account_id, action)` decides. The policy table is pure (`domain/accounts.py`, `can(permission, action)`), the use cases stay as they are, and every route declares its action in its decorator.
- **Three actions** cover Story 5's table: `view` (every `GET`), `work` (board: create, move and edit tasks, checklists; editing a document), `manage` (everything else: edit project, capacity, planning, proposals, replan, close sprint, GitHub, regenerate documents, team, invitation). Spec 009 lists maintaining documents with the board work, so editing one is `work`; regenerating calls the agents, so it's `manage`.
- **Outsiders get the resource's own 404** (`project_not_found`, `task_not_found`…), the same as a missing id, so ids can't be probed. Members doing a leader action get `403 forbidden`.
- **Members are linked, not replaced.** `Member` keeps every spec 001 field and adds `account_id` (null only for members created before accounts, e.g. in unit tests) and `permission` (`leader` | `member`). Spec 001's diff ignores `permission`, so changing it doesn't publish `team_changed` (FR-013).
- **Team changes reuse `apply_update`.** Joining, editing a member and removing one build a `ProjectChanges` with the whole team, so names stay unique, limits are checked and the `TeamDiff` comes out as before. A shared `TeamChanges` (in `use_cases/projects/team.py`) unassigns the pending tasks of whoever left and saves (`stage`), and after the use case commits publishes one `team_changed` per changed project (`publish`; code moved out of `UpdateProject`). `PATCH /api/projects/{id}` no longer takes `members`.
- **Profile → project copy.** Creating and joining copy name, role, seniority, hours, skills and GitHub username into the `Member`. Later profile changes only propagate the name (renaming the member in each project, with the same uniqueness suffix, publishing `team_changed` like a rename in spec 001).
- **Unique names**: `unique_name("Ana Gómez", taken)` returns the name, or `Ana Gómez 2`, `3`… comparing like spec 001 (case and spaces ignored).
- **Invitation link**: one `invite_token` per project (`secrets.token_urlsafe(16)`), stored as is because the leader has to see it again, and `exclude`d from `Project` dumps like the GitHub token. A new project starts with one. Renewing replaces it; turning it off sets it to null. The frontend builds the URL as `{origin}/join/{token}`.
- **The live stream re-checks membership.** Before sending each event, the SSE loop runs `AuthorizeAccess` with a fresh unit of work; a removed member's stream ends at the `team_changed` that removes them.
- **Old databases**: after `create_all`, `create_db` checks that `member.account_id` exists and otherwise stops with "The database predates spec 015: delete agile.db".
- **Tests stay readable**: the `client` fixture signs up a leader; `tests/api.py` has `sign_up`, `as_new_user` and `create_project(client, body)`. The latter accepts the old body with `members`: the first one becomes the signed-in leader's profile, the others sign up in their own clients and join with the link. So the other specs' API tests only change how they create the project. The fixture swaps in a cheap scrypt cost (n=2^8) because API tests sign up many people; `test_accounts_persistence.py` checks the real hasher.
- **Not covered by a test**: a removed member's open SSE stream closing mid-stream (it needs two concurrent clients); `AuthorizeAccess.allows`, which it relies on, is tested.

## Project Structure

### Documentation (this feature)

```text
specs/015-accounts-invitations/
├── spec.md
├── plan.md               # This file
└── frontend-prompt.md    # Prompt for the frontend work (Phase 9)
```

### Source Code (repository root)

```text
backend/
├── app/config.py                                         # COOKIE_SECURE
├── app/main.py                                           # hasher, routers, CORS credentials, prune sessions
├── app/domain/accounts.py                                # NEW: Account, AuthSession, policy, validation, unique_name
├── app/domain/project.py                                 # Member.account_id/permission, Project.invite_token
├── app/domain/errors.py                                  # NotAuthenticated, InvalidCredentials, Forbidden, LastLeader, InvitationNotFound
├── app/application/ports/security.py                     # NEW: PasswordHasher
├── app/application/ports/repositories.py                 # AccountRepository, SessionRepository, project lookups
├── app/application/ports/unit_of_work.py                 # accounts, sessions
├── app/application/dto.py                                # SignUp, SignIn, ProfileUpdate, MemberUpdate, JoinRequest, Invitation…
├── app/application/use_cases/accounts/                   # NEW: sign_up, sign_in, sign_out, authenticate, update_profile, authorize
├── app/application/use_cases/projects/team.py            # NEW: TeamChanges, JoinProject, UpdateMember, RemoveMember
├── app/application/use_cases/projects/invitation.py      # NEW: Get/Renew/Disable/PreviewInvitation
├── app/application/use_cases/projects/*.py               # create (leader), list (by account), update (no team)
├── app/adapters/outbound/security/password_hasher.py     # NEW: ScryptPasswordHasher
├── app/adapters/outbound/persistence/                    # tables, mappers, repositories, unit_of_work, db
├── app/adapters/inbound/http/accounts.py                 # NEW: /api/auth/*, /api/me
├── app/adapters/inbound/http/team.py                     # NEW: members, invitation, /api/invitations/*
├── app/adapters/inbound/http/session_cookie.py           # NEW
├── app/adapters/inbound/http/dependencies.py             # current_account, allow(), new use cases
├── app/adapters/inbound/http/errors.py                   # 401, 403
├── app/adapters/inbound/http/*.py                        # a guard on every project route
└── tests/                                                # api.py, conftest, fakes, new tests, existing API tests
plan/api-conventions.md, plan/use-cases.md                # auth, new codes
specs/constitution.md                                     # principle 5
specs/001-project-team-setup/spec.md                      # team comes from accounts
frontend/docs/api-contract.md                             # new endpoints and shapes
```

**Structure Decision**: accounts get their own use case package; team and invitation use cases live with projects because they change a project's team.

## API Contract

New domain errors (added to [plan/api-conventions.md](../../plan/api-conventions.md)):

| Error | Status | `code` |
|---|---|---|
| `NotAuthenticated` | 401 | `not_authenticated` |
| `InvalidCredentials` | 401 | `invalid_credentials` |
| `Forbidden` | 403 | `forbidden` |
| `InvitationNotFound` | 404 | `invitation_not_found` |
| `LastLeader` | 409 | `last_leader` |

Every endpoint under `/api` answers `401 not_authenticated` without a valid session, except `POST /api/auth/signup`, `POST /api/auth/signin`, `GET /api/invitations/{token}` and `GET /api/health`. `/webhooks/github` keeps its signature. Project routes answer the resource's `404` to non-members and `403 forbidden` to members doing a `manage` action.

### Shared shapes

**Account** (what `GET /api/me` returns; never a password or hash)

```json
{
  "id": 1, "email": "ana@team.dev", "name": "Ana Gómez",
  "role": "Backend", "seniority": "senior", "hours_per_week": 30,
  "skills": ["Python"], "github_username": null, "avatar_url": "/avatars/ana-gomez.jpg",
  "created_at": "2026-10-23T14:05:00Z"
}
```

**Member** (inside `Project.members`): spec 001's fields plus `"account_id": 1`, `"permission": "leader"` and `"avatar_url"` (the account's photo, or `null`).

**ProjectSummary**: spec 001's fields plus `"permission": "leader" | "member"` (the caller's).

**Invitation**: `{"active": true, "token": "k3Jx…"}`, `{"active": false, "token": null}` when off.

### `POST /api/auth/signup` — create an account (US1)

```json
{ "name": "Ana Gómez", "email": "ana@team.dev", "password": "at-least-8" }
```

| Status | When | Body |
|---|---|---|
| `201` | Created and signed in. `Set-Cookie: agile_session=…`, `Location: /api/me` | `Account` |
| `422` | `name` empty or > 120; `email` not an email or > 254; `password` < 8 or > 128; `email` already registered (`"Already registered."`) | `validation_failed` |

### `POST /api/auth/signin` — sign in (US1)

`{"email": "...", "password": "..."}` → `200` `Account` + `Set-Cookie`; `401 invalid_credentials` for a wrong password or unknown email (same detail); `422` for missing fields.

### `POST /api/auth/signout` — sign out (US1)

`204`, clears the cookie. Without a session also `204` (idempotent).

### `GET /api/me` / `PATCH /api/me` — my account and profile (US1, US2)

`PATCH` body (partial; `null` clears `role`, `github_username` and `avatar_url`):

```json
{ "name": "Ana Gómez", "role": "Backend", "seniority": "senior", "hours_per_week": 30, "skills": ["Python"], "github_username": "ana-g", "avatar_url": "/avatars/ana-gomez.jpg" }
```

| Status | When | Body |
|---|---|---|
| `200` | Saved. A new name renames the member in each of the account's projects (`team_changed` per project); a new `avatar_url` is copied to those members without an event | `Account` |
| `422` | Empty body; spec 001's member limits; bad GitHub username; `avatar_url` not an `https://` URL or a path starting with `/`, or > 500 | `validation_failed` |

### `POST /api/projects` — create (changes spec 001, US3)

Spec 001's body without `members`, plus optional `role` (the creator's role in this project; defaults to the profile's).

| Status | When | Body |
|---|---|---|
| `201` | Draft with one member: the caller, `leader`, from the profile; with an active invitation | `Project` |
| `422` | Spec 001's rules; `role` missing when the profile has none, or > 60 | `validation_failed` |

### `GET /api/projects` (changes spec 001)

Only the caller's projects, newest first, each with `permission`.

### `PATCH /api/projects/{id}` (changes spec 001)

`manage`. No `members` field any more (it's ignored); the team changes through the endpoints below.

### `PATCH /api/projects/{id}/members/{member_id}` — edit a member (US6)

`manage`. Partial: `name`, `role`, `seniority`, `hours_per_week`, `skills`, `permission`.

| Status | When | Body |
|---|---|---|
| `200` | Saved; `team_changed` unless only `permission` changed | `Project` |
| `404` | Unknown project or member, or member of another project | `project_not_found` / `member_not_found` |
| `409` | Demoting the last leader | `last_leader` |
| `422` | Empty body; spec 001's limits (`field` is the field name, e.g. `role`); duplicated name | `validation_failed` |

### `DELETE /api/projects/{id}/members/{member_id}` — remove or leave (US6)

`view` plus: a leader removes anyone, a member only themselves (else `403 forbidden`). `204`; pending tasks unassigned; `team_changed`. `409 last_leader` for the last leader.

### `GET /api/projects/{id}/invitation`, `POST …/invitation`, `DELETE …/invitation` (US4)

`manage`. `GET` → `200 Invitation`. `POST` → `200 Invitation` with a new token (the old one stops working; turns invitations on). `DELETE` → `204`, invitations off.

### `GET /api/invitations/{token}` — preview (US4, no session needed)

`200` `{"project_name": "Online store", "leaders": ["Ana Gómez"], "already_member": false}` (`already_member` is `false` without a session). `404 invitation_not_found` for an unknown or replaced token, or invitations off.

### `POST /api/invitations/{token}/join` — join (US4)

Body optional: `{"role": "Design"}` (defaults to the profile's role).

| Status | When | Body |
|---|---|---|
| `200` | Joined as `member` (`joined: true`, `team_changed`), or already a member (`joined: false`, nothing changes) | `{"project_id": 7, "joined": true}` |
| `401` | No session | `not_authenticated` |
| `404` | Token not valid | `invitation_not_found` |
| `422` | No role in the body nor the profile | `validation_failed` on `role` |

### Guards on the existing endpoints

| Action | Endpoints |
|---|---|
| `view` | `GET` project, plan, board, activity, events, proposals, proposal, documents, document |
| `work` | `POST /projects/{id}/tasks`, `PATCH /tasks/{id}`, `PUT /tasks/{id}/checklist`, `PUT /documents/{id}` |
| `manage` | `PATCH /projects/{id}`, `PUT /projects/{id}/capacity`, `POST /projects/{id}/planning`, `POST …/planning/stages/{stage}/retry`, `POST /projects/{id}/replan`, `POST /sprints/{id}/close`, proposals approve/adjust/reject/apply and bulk approve, repository connect/disconnect, `POST …/issues/propose`, `PUT /members/{id}/github-username`, `POST /documents/{id}/regenerate`, members and invitation endpoints |

---

## Phase 1: Setup

- [x] T001 Amend constitution principle 5 and the auth lines in `plan/api-conventions.md`; update spec 001 (creating a project takes no team, the team comes from accounts)
- [x] T002 `COOKIE_SECURE` in `app/config.py`

## Phase 2: Foundational

- [x] T003 `domain/accounts.py`: `Account`, `AuthSession`, `Permission`, `ProjectAction`, `can`, `check_access`, `normalize_email`, `signup_errors`, `profile_errors`, `unique_name`, `ensure_leader`, `token_digest`
- [x] T004 `Member.account_id`, `Member.permission`, `Project.invite_token` (excluded) in `domain/project.py`; new errors in `domain/errors.py` and their statuses in `http/errors.py`
- [x] T005 Ports: `PasswordHasher`; `AccountRepository`, `SessionRepository`; `ProjectRepository.list_by_account`, `get_by_invite_token`; `UnitOfWork.accounts/sessions`
- [x] T006 Persistence: tables, mappers, repositories, unit of work; schema check in `create_db`
- [x] T007 `ScryptPasswordHasher`; fakes in `tests/fakes.py`
- [x] T008 `Authenticate`, `AuthorizeAccess`; `current_account` and `allow()` guards; session cookie helper; CORS credentials

## Phase 3: US1 · Accounts

- [x] T009 `SignUp`, `SignIn`, `SignOut`; `/api/auth/*` and `GET /api/me`
- [x] T010 Tests: domain validation, use cases, API (cookie set, 401s, same message for both sign in failures, never a hash)

## Phase 4: US2 · Profile

- [x] T011 `UpdateProfile` (name propagation) and `PATCH /api/me`
- [x] T012 Tests

## Phase 5: US3 · Create and list as leader

- [x] T013 `CreateProject` from the account, `ListProjects` by account with `permission`; `UpdateProject` without team; `TeamChanges` extracted
- [x] T014 Guards on every existing route (table above), SSE membership re-check
- [x] T015 `tests/api.py`, signed-in `client` fixture; existing API tests create projects through `create_project`; tests for outsiders (404)

## Phase 6: US4 · Invitation and join

- [x] T016 Invitation use cases and endpoints; `PreviewInvitation`, `JoinProject`
- [x] T017 Tests

## Phase 7: US5 · Permissions

- [x] T018 Tests: a member works on the board and gets 403 on every `manage` route

## Phase 8: US6 · Team management

- [x] T019 `UpdateMember`, `RemoveMember` and their endpoints
- [x] T020 Tests

## Phase 9: Polish

- [x] T021 `frontend/docs/api-contract.md`: shapes, `AuthGateway`, `TeamGateway`, 401/403 handling
- [x] T022 [frontend-prompt.md](frontend-prompt.md): the prompt for the frontend (spec 015 screens, gateways, fakes)
- [x] T023 Full test suite green

## Phase 10: Frontend

Follow [frontend-prompt.md](frontend-prompt.md); it has the detail for each task.

- [x] T024 Domain types and rules: `Account`, `Permission`, `Invitation`, `InvitationPreview`, `JoinResult`, `ProfileUpdate`, `MemberUpdate`; `Member.account_id/permission`, `ProjectSummary.permission`; `ProjectCreate` without `members`; `canManage(project, me)`
- [x] T025 Ports and HTTP adapters: `AuthGateway`, `TeamGateway`; `ProjectGateway` shapes; a `401 not_authenticated` from any call goes to `/login?next=` (handled once in `application/session.ts`; `client.ts` only turns it into an `ApiError`)
- [x] T026 Fake adapters: accounts, sessions, invitations and permissions in the fake backend; starts signed in as a demo leader with a demo member
- [x] T027 Session: `useSession` (me, sign in, sign up, sign out), route guard for every screen except `/login`, `/signup`, `/join/:token`
- [x] T028 Screens: sign in (with the "Próximamente" Google, GitHub and SSO buttons), sign up, profile step, join page
- [x] T029 New project form without the team (role prefilled from the profile); projects list shows the permission
- [x] T030 Team screen (`/projects/:id/team`): members with their data and permission, edit, make Leader/Member, remove, leave; the invitation link card (copy, new link, turn off)
- [x] T031 Hide every leader action from members (Story 5's table) across planning, proposals, board settings, integrations, documents and settings
- [x] T032 Account menu (profile, sign out) in the top bar
- [x] T033 Tests (Vitest + Testing Library on the fake gateways), `npm run lint`, `npm run typecheck`, `npm test`
- [x] T034 `python -m app.seed` (`backend/app/seed.py`): the demo accounts Ana (leader) and Leo (member), password `agile-demo`, and a project they share, created through the API so every rule applies; idempotent

## Phase 11: Profile photo (FR-005, amended)

No upload: the app shows a photo when the profile has a link to one. The demo accounts use Pexels portraits saved in `frontend/public/avatars/` (free to use, no attribution required).

- [x] T035 `avatar_url` on `Account` and `Member` (domain, tables, mappers); `create_db` adds the column to an existing database; validation; copied when creating or joining a project; `UpdateProfile` copies a new photo to the account's members without `team_changed`
- [x] T036 Tests: validation, propagation without event, `PATCH /api/me`
- [x] T037 Seed: Ana and Leo get their photo, also when the accounts already exist
- [x] T038 Frontend: `avatar_url` in the domain types and fakes (demo accounts and guests with photo); `Avatar` shows the photo and falls back to initials; every avatar passes it
- [x] T039 Profile page: an identity card (photo in the notch, name, role, seniority, hours, skills, as the team sees you) next to the form: one card for my information, GitHub apart (later it becomes connecting the account). `NotchedPanel` clips its shape instead of painting the cut, so the dark glow shows through
- [x] T040 `frontend/docs/api-contract.md`; lint, typecheck and tests

## Dependencies & Execution Order

- Phase 2 blocks everything. US1 → US2 → US3 (needs accounts) → US4 (needs a leader) → US5/US6.
- T015 must land with T014: once the guards are on, the old API tests need the signed-in client.
- Phase 10 only needs the API contract; T024–T027 first, then the screens in any order.
