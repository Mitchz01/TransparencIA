# API conventions

Rules every HTTP endpoint follows. Each spec's `plan.md` has an **API Contract** section with its endpoints; anything not written there follows this document. The frontend's consolidated view (TypeScript shapes, gateways, UI reaction per error) is [frontend/docs/api-contract.md](../frontend/docs/api-contract.md).

## Basics

- Base path: `/api` for the app, `/webhooks` for external callers (GitHub).
- JSON only, UTF-8. Field names in `snake_case`, the same as the Pydantic models.
- Ids are integers. Dates and times are ISO 8601 in UTC (`2026-10-23T14:05:00Z`); dates without time are `YYYY-MM-DD`.
- Enums are lowercase strings (`"in_progress"`, `"scrumban"`).
- Accounts with email and password (spec 015, constitution principle 5). The session is an `HttpOnly` cookie, `agile_session`; every `/api` endpoint needs it except signing up, signing in, the invitation preview and health. GitHub authenticates through the webhook signature.
- Secrets (GitHub tokens) are **write-only**: they are accepted in requests and never returned. Responses expose `has_token: bool` instead.

## Headers

### Request

| Header | When | Value |
|---|---|---|
| `Content-Type` | Every request with a body | `application/json`. Anything else → `400 malformed_request` |
| `Accept` | Optional | `application/json`; `text/event-stream` for the SSE endpoint |
| `X-Request-Id` | Optional | Client-generated id to trace a request. If missing, the server creates one |

Webhook requests carry GitHub's own headers instead; see spec 008.

### Response

| Header | When | Value |
|---|---|---|
| `Content-Type` | Always (except `204`) | `application/json; charset=utf-8`, or `text/event-stream` for SSE |
| `X-Request-Id` | Always | The request's id (echoed or generated). It's also in the server log line of the request |
| `Location` | `201 Created` | URL of the new resource, e.g. `/api/projects/12` |

CORS allows the origins in `CORS_ORIGINS` (`http://localhost:5173` in dev).

## Status codes

| Code | Use it when | Body |
|---|---|---|
| `200 OK` | A read, an update, or an action that finishes inside the request | The resource or the action result |
| `201 Created` | A `POST` created a resource | The new resource + `Location` header |
| `202 Accepted` | The work continues in the background (agents, GitHub processing). Agents **never** run inside the request | An acknowledgement (`{"project_id": 1, "status": "planning"}`); progress arrives over SSE |
| `204 No Content` | A `DELETE` succeeded | Empty |
| `400 Bad Request` | The request can't be read: body isn't valid JSON, wrong `Content-Type`, missing required header | Error |
| `401 Unauthorized` | No valid session (`not_authenticated`), wrong email or password (`invalid_credentials`), or webhook signature missing or wrong | Error |
| `403 Forbidden` | Signed in and a member of the project, but the action needs a leader (spec 015) | Error with `code: "forbidden"` |
| `404 Not Found` | An id in the path doesn't exist | Error |
| `409 Conflict` | The request is valid but not allowed in the current state (planning already running, proposal already resolved, repo not connected…) | Error |
| `422 Unprocessable Entity` | The JSON is readable but breaks a rule: missing field, wrong type, out of range, a domain validation | Error with `errors` |
| `500 Internal Server Error` | Unexpected failure. The message never includes internals (stack traces, SQL, tokens) | Error with `code: "internal_error"` |
| `502 Bad Gateway` | GitHub failed or timed out during a synchronous call | Error with `code: "code_host_unavailable"` |

Rule of thumb: **400** = can't read it, **422** = read it and it's wrong, **409** = it's right but not now.

## Error body

Every error, from any endpoint, has the same shape:

```json
{
  "code": "validation_failed",
  "detail": "The project has invalid fields.",
  "errors": [
    { "field": "members[1].hours_per_week", "message": "Must be between 1 and 60." },
    { "field": "name", "message": "Required." }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `code` | string | Stable, machine-readable. The frontend switches on this, never on `detail` |
| `detail` | string | Human-readable message, safe to show in the UI |
| `errors` | list of `{field, message}` | Only on `422`. `field` is a path into the request body (`members[0].name`); `""` means the whole body. All failing fields are listed, not just the first |

Some errors add context fields next to these (documented in the plan of the endpoint), e.g. `{"code": "repository_not_accessible", "detail": "…", "reason": "forbidden"}`.

## Error codes

Domain errors live in `backend/app/domain/errors.py`; `adapters/inbound/http/errors.py` maps them. New codes are added here and in the plan that introduces them.

| Domain error | Status | `code` | Spec |
|---|---|---|---|
| Request body not JSON / wrong `Content-Type` / missing header | 400 | `malformed_request` | all |
| Request schema validation (FastAPI `RequestValidationError`) | 422 | `validation_failed` | all |
| `ValidationFailed` | 422 | `validation_failed` | 001 |
| `NotFound` subclasses | 404 | `<entity>_not_found` (`project_not_found`, `task_not_found`, `sprint_not_found`, `member_not_found`, `document_not_found`, `proposal_not_found`, `stage_not_found`, `version_not_found`) | all |
| `MethodologyLocked` | 409 | `methodology_locked` | 001 |
| `PlanningAlreadyRunning` | 409 | `planning_already_running` | 002 |
| `PlanningNotStartable` | 409 | `planning_not_startable` | 002 |
| `StageNotRetryable` | 409 | `stage_not_retryable` | 002 |
| `ProposalAlreadyResolved` | 409 | `proposal_already_resolved` | 005 |
| `ProposalNotRetryable` | 409 | `proposal_not_retryable` | 005 |
| `SprintClosed` | 409 | `sprint_closed` | 003 |
| `CapacityNotApplicable` | 409 | `capacity_not_applicable` | 003 |
| `RegenerationInProgress` | 409 | `regeneration_in_progress` | 006 |
| `VersionConflict` | 409 | `version_conflict` | 006 |
| `InvalidDiagram` | 422 | `invalid_diagram` | 006 |
| `RepositoryNotAccessible` | 422 | `repository_not_accessible` | 007 |
| `RepositoryNotConnected` | 409 | `repository_not_connected` | 007 |
| `NothingToPublish` | 409 | `nothing_to_publish` | 007 |
| `PublicationPending` | 409 | `publication_pending` | 007 |
| `CodeHostUnavailable` | 502 | `code_host_unavailable` | 007 |
| `PlanNotApplied` | 409 | `plan_not_applied` | 008 |
| `SprintAlreadyClosed` | 409 | `sprint_already_closed` | 008 |
| Invalid webhook signature | 401 | `invalid_signature` | 008 |
| `NotAuthenticated` | 401 | `not_authenticated` | 015 |
| `InvalidCredentials` | 401 | `invalid_credentials` | 015 |
| `Forbidden` | 403 | `forbidden` | 015 |
| `InvitationNotFound` | 404 | `invitation_not_found` | 015 |
| `LastLeader` | 409 | `last_leader` | 015 |
| Anything else | 500 | `internal_error` | all |

## Updates

- `PATCH` = partial update: a missing field is left as is; `null` clears it (only for nullable fields). An empty body → `422` (`errors: [{"field": "", "message": "No fields to update."}]`).
- `PUT` = replace the whole sub-resource (the checklist, the repository connection).
- Updates are all-or-nothing: if any field fails, nothing is saved.

## Server-Sent Events

`GET /api/projects/{id}/events` (spec 005) is the only streaming endpoint:

- Request: `Accept: text/event-stream`; `Last-Event-ID: <seq>` on reconnect (the browser's `EventSource` sends it), or `?after=<seq>` on the first connection.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- One SSE message per domain event: `id:` is the event's `seq`, `event:` its `type`, `data:` the event as JSON.
- Replay: events after the given `seq` are sent first. If there are more than 200, a single `resync` event is sent instead and the client refetches its state with the regular `GET` endpoints.
- A comment line (`: ping`) every 15 s keeps proxies from closing the connection.

## Implementation checklist

Owned by spec 001 (it lands first); the others reuse it:

- `DomainError` handler that returns the error body above with the status from the table.
- `RequestValidationError` handler: JSON decode errors → `400 malformed_request`; everything else → `422 validation_failed` with one `errors` entry per failing field.
- Catch-all handler → `500 internal_error`, logging the exception with the request id.
- `X-Request-Id` middleware (read or generate, add to the response and to the log context).
- Frontend `ApiError` in `adapters/http/client.ts` parses `code`, `detail` and `errors`.
