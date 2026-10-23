# P3 — API

You own **storage, use cases, endpoints and the seed**: the glue between P1's rules, P2's agents and the
two frontends. Plan tasks: T008, T011–T013, T015, T018, T019, T023. Endpoints and status codes are in
[plan.md → API Contract](../plan.md#api-contract); the API tests must assert every status row.

## Your files (only these)

- `apps/api/app/application/ports/repositories.py`, `ports/unit_of_work.py`
- `apps/api/app/adapters/outbound/persistence/` (tables, mappers, repositories, unit_of_work)
- `apps/api/app/domain/project.py` (only `public`, `public_slug`)
- `apps/api/app/application/use_cases/transparency/`: `get_budget.py`, `set_budget.py`,
  `draft_expense.py`, `discard_expense.py`, `set_publication.py`, `get_portal.py`, `answer_alert.py`
  (not `confirm_expense.py` → P1, not `ask_citizen.py` → P2)
- `apps/api/app/adapters/inbound/http/transparency.py`, `http/public.py`, `http/errors.py` (new error
  mappings), `http/dependencies.py` (providers)
- `apps/api/app/main.py`, `apps/api/app/config.py`, `apps/api/app/seed.py`
- `apps/api/tests/integration/adapters/test_transparency_api.py`, `test_transparency_persistence.py`

## Phase 1 (0:10–0:50): storage and endpoints in mock mode

1. **Persistence**:
   - Tables: `BudgetTable` (one row per project; `lines` as a JSON column), `ExpenseTable`, `AlertTable`
     (`expense_id`, indexed), `StoredFileTable` (`data` as `LargeBinary`).
   - `TaskTable` gains `done_at: datetime | None`; the generic mappers carry it.
   - `ProjectTable` gains `public: bool` and `public_slug: str | None` (unique, indexed).
   - `ExpenseRepository.save` writes the expense's alerts and assigns their ids.
   - `create_all` doesn't migrate: tell everyone to run `rm agile.db && python -m app.seed` after your push.
2. **Use cases** (signatures in the [README](README.md#backend--use-cases-appapplicationuse_casestransparency)):
   - `SetBudget` validates with P1's `budget_errors` and raises `ValidationFailed`.
   - `DraftExpense`:
     - The file must be PDF, JPEG, PNG or WebP and at most 10 MB, else `UnsupportedFile`.
     - No budget raises `BudgetMissing`.
     - Build the agent context: the budget, `contract_period`, and the tasks as `{id, title, sprint}`.
     - Call `agents.read_evidence`. **Only on success** store the file and the draft, with the AI alerts
       as `source="ai"`.
     - If the agent returns a `budget_line_id` or `task_id` that doesn't exist, set it to null and add a
       `low` alert.
   - `DiscardExpense`: drafts only, else `ExpenseNotDraft`.
   - `SetPublication`:
     - The first publish generates `secrets.token_urlsafe(8)`; unpublishing keeps the slug.
     - No budget raises `BudgetMissing`.
     - `public_url = f"{PUBLIC_APP_URL}/p/{slug}"`. With `PUBLIC_APP_URL` empty it's `/p/{slug}`, and the
       frontend prefixes the origin.
   - `GetPortal`:
     - Assemble `Portal` from P1's `summary`, `line_status`, `weekly_timeline` and `sprint_progress`, over
       confirmed expenses only. Expenses newest first; alerts carry `expense_id`.
     - `for_team` adds `drafts` and `public`.
     - `for_public` raises `ProjectNotFound` for an unknown or unpublished slug.
     - Never expose emails, hours or members.
   - `AnswerAlert`: 1–500 chars, sets `answered_at`.
   - Until P1 pushes the rules (0:50), use the skeleton's stubs. Your tests can start with budget and
     drafts, which don't need them.
3. **Endpoints**:
   - `http/transparency.py` (private). Guards: `Depends(allow("view"))` for reads, `allow("work")` for
     uploading, confirming and discarding, `allow("manage")` for budget, publication and answers.
   - `GET /api/files/{file_id}`: members of its project, or anyone if the file belongs to a confirmed
     expense of a published project; else `file_not_found`.
   - Uploads with FastAPI's `UploadFile` (`multipart/form-data`, field `file`).
   - `http/public.py` (no session): `GET /api/public/projects/{slug}`, `POST .../ask` (P2's `AskCitizen`).
   - Map the new errors in `http/errors.py`: `budget_missing` and `expense_not_draft` → 409,
     `unsupported_file` → 422, `agent_unavailable` → 502. The `NotFound` ones map by themselves.
4. **API tests** with `MOCK_AGENTS=1`, following `test_documents_api.py`. Push by 0:50 and announce it:
   P4 and P5 switch to the real backend.

## Phase 2 (0:50–1:30): seed and cuts

1. **Seed** (`seed.py`, FR-017, D11). Keep the two accounts: Ana is the leader and the foundation; Leo
   is a member. Replace the shared planning project with the mangrove project, built directly through
   the repositories (not the agents):
   - `status="ready"`, methodology scrum.
   - 6 sprints, one per phase: Diagnóstico, Vivero, Siembra lotes 1–2, Siembra lotes 3–5,
     Mantenimiento, Monitoreo y cierre. Sprints 1–2 closed; `end_date` every ~4 weeks from `2026-08-03`.
   - About 16 tasks with points. Include "Comprar plántulas" and "Sembrar lote 1 (1 ha)". The done
     tasks have `done_at` spread over weeks 1–11, for about 30% physical progress.
   - The budget and the 3 confirmed expenses of the README, with small placeholder images or PDFs as
     their files (P2 can hand you the demo files).
   - The portal published, with a fixed slug `manglar-cienaga` so the printed QR never changes.
   - Running it twice changes nothing.
2. **Cuts (D13)**:
   - `GENERATE_DOCUMENTS` in `config.py`, default off. When off, `main.py` doesn't append
     `generate_documents` to `on_plan_completed`.
   - Skip the issue-proposals follow-up while `MOCK_GITHUB`.
   - Routers stay mounted and their tests keep passing.
3. Wire P1's `ConfirmExpense` and P2's `AskCitizen` to their endpoints as soon as they push.

## Phase 3 (1:30–2:20)

You're the integration lead at sync 2: run `pytest`, fix what's yours, route the rest to its owner.

## Done when

`pytest` is green (including `tests/architecture`). A fresh `rm agile.db && python -m app.seed` gives
the demo project with its portal at `/p/manglar-cienaga`.
