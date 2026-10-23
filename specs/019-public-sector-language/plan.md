# Implementation Plan: Public-sector language and a work plan the evidence keeps up to date

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Three moves, none of them renames anything inside the code or the database:

1. **Words on screen**: the team app's labels and texts follow the spec's glossary. Most labels already
   live in a few files (`stageLabels.ts`, `boardLabels.ts`, `profileLabels.ts`, `proposalContent.ts`); the
   rest are inline texts in about 40 components.
2. **What the agents write**: the planning prompts, the field descriptions the model reads, and the mock
   data plan a public project by stages. The output schemas keep their shape.
3. **Evidence → plan adjustment**: confirming evidence of an activity publishes an event; a hook asks
   spec 008's replan for an adjustment with the evidence as the reason; a new change kind, `complete`,
   finishes an activity when the leader approves.

## Technical Context

**Language/Version**: Python 3.13; TypeScript 6 + React 19  
**Primary Dependencies**: no new ones  
**Testing**: pytest (replan `complete`, the evidence hook, prompts unchanged in shape); vitest (labels in
the board, planning and replan screens); a text scan of the demo's path for the glossary's "Today" words  
**Constraints**: the API Contract changes only in D6 (one change kind, one event); everything else is
text

### Decisions

- **D1 — Words at the edges only.** Labels, prompts, field descriptions and mock data change; identifiers,
  API fields and tables (`sprint`, `task`, `epic_key`, `points`) don't. No migration, no contract break
  outside D6.
- **D2 — One glossary in the team app.** `ui/vocabulary.ts` holds the shared words (stage, activity,
  component, weight…) so inline texts import them instead of repeating them. The existing label maps
  (`STAGE_LABELS`, `STATUS_LABELS`, seniority labels, agent titles) switch to the glossary.
- **D3 — Always by stages.** `ProjectForm` drops the methodology field and sends
  `requested_methodology: "scrum"`: Scrum's sprints are the stages, and the backend and board need no
  change. The methodology prompt says: the plan is always by stages of 2 to 4 weeks, ceremonies are
  follow-up meetings (comité de seguimiento, visita de campo, informe de avance), no WIP limits, no
  alternatives. The UI shows the methodology stage as "Forma de trabajo: por etapas" with its meetings,
  and hides WIP limits and alternatives.
- **D4 — Architecture becomes "Componentes y recursos"** with the same schema: `style` = modalidad de
  ejecución, `components` = the project's components, `stack` = recursos e insumos, `decisions` =
  decisiones clave. `domain/plan.py`'s `Field(description=…)` texts lose their software examples
  ("modular monolith", "Fibonacci", "US-1").
- **D5 — Activities.** Keys `A-1…` (prompt and description); `type` is always `feature` and hidden;
  `points` read as weight (1–13); acceptance criteria read as compliance criteria; `epic_key` as the
  component.
- **D6 — Evidence → adjustment (API Contract change, agree it with the contracts owner first):**
  - `ReplanChangeKind` gains `"complete"` (`task_key`, `expected_status`, `rationale`). `apply_replan`
    finishes the task through `reorder`, so `done_at` is set (spec 017 D5). Frontend:
    `proposalContent.ts` union + `ReplanDiff` group "Terminar" ("A-5 queda terminada").
  - New domain event `ExpenseConfirmed(project_id, expense_id, task_id, kind, alert_count)`, published by
    `ConfirmExpense` (gains the `EventBus`). Shown in the feed as "Se confirmó una evidencia de A-5".
  - `ProposeReplanOnDrift.on_expense_confirmed`: nothing without `task_id` or an applied plan; else
    `replan.request(project_id, reason, origin="automatic")` with a Spanish reason that names the
    evidence, the activity and whether it has alerts. Spec 008's merge of pending replans (FR-014) covers
    several evidences in a row.
  - Replan prompt: "If the reason is confirmed evidence of an activity, propose completing it unless the
    evidence has alerts; if a past stage still has pending activities, propose moving them." Mock replan:
    a `complete` change for the activity named in an evidence reason without alerts.
- **D7 — Spanish reasons.** `team_drift_reason` and `sprint_drift_reason` move to Spanish with the
  glossary (they're shown to the leader).
- **D8 — Hide what's left of software features**: `IssueBadge` and the GitHub section of the task panel,
  the GitHub user field (team, profile), task type, WIP slots, the "Ver documentos" link of planning, the
  integrations link of `AgentsPill`, the architecture view's stack wording, and the sign-in showcase and
  home templates that talk about apps.
- **D9 — Coordination.** This touches files other people own: P2 (`adk/prompts.py`), P1
  (`confirm_expense.py`), P3 (`main.py`), the frontend owners of planning, board and team screens, and the
  contracts owner (D6). Work on `feat/public-language`, announce each shared file before editing it, and
  land D6 only after the contract is agreed.

## Project Structure

```text
specs/019-public-sector-language/   spec.md, plan.md
specs/constitution.md               principles 1, 3, 4: by stages, no methodology choice

apps/api/app/
  domain/plan.py                    Field descriptions (D4, D5); ReplanChangeKind + "complete" (D6)
  domain/events.py                  ExpenseConfirmed (D6)
  domain/board.py                   replan_status / apply rules for "complete" (D6)
  application/use_cases/transparency/confirm_expense.py   publish ExpenseConfirmed (D6, P1)
  application/use_cases/planning/apply_replan.py          "complete" (D6)
  application/use_cases/planning/propose_replan_on_drift.py  on_expense_confirmed, Spanish reasons (D6, D7)
  adapters/outbound/agents/adk/prompts.py                 by stages, components and resources, A-n (D3–D6, P2)
  adapters/outbound/agents/mock/data.py, agents.py        the mangrove plan; mock "complete" (D4–D6)
  main.py                                                 wire the hook (P3)
apps/api/tests/                     replan complete, evidence hook, Spanish reasons, mock plan words

apps/team/src/
  ui/vocabulary.ts                  the glossary (D2)
  domain/proposalContent.ts         agent titles; ReplanChange "complete" (D6)
  ui/components/planning/*          stage labels and bodies (D3, D4)
  ui/components/board/*             columns, stages, weight, steps, metas; no type, no issue (D5, D8)
  ui/components/replan/*            "Ajuste del plan de trabajo", "Terminar" (D6)
  ui/components/plan/*, ui/pages/PlanPage.tsx   Cronograma, Componentes y recursos
  ui/components/project/ProjectForm.tsx         no methodology (D3)
  ui/components/team/*, account/*   cargo, experiencia, no GitHub user (D8)
  ui/components/activity/*          feed texts (D6, D7)
  ui/components/shell/sections.ts   "Actividades", "Plan de trabajo"
  ui/components/home/*, auth/*      public-project copy (D8)
  adapters/fake/*                   demo data in public-project words; fake replan "complete"
apps/team/docs/api-contract.md      D6
plan/context.md                     the product as public-project planning
```

## API Contract

Only D6 changes it. To be agreed with the contracts owner before coding.

- `ReplanChange.kind`: `"move" | "reassign" | "add" | "discard" | "complete"`. `complete` carries
  `task_key`, `expected_status` and `rationale`; it's skipped if the task's status changed, like `move`.
- New event in the activity feed and the SSE stream: `expense_confirmed`
  `{ project_id, expense_id, task_id, kind, alert_count, summary, ref: { kind: "expense", id } }`.

## Phase 1: Setup

- [ ] T001 Agree D6 with the contracts owner; add it to this plan's API Contract and `api-contract.md`
- [ ] T002 Amend the constitution (principles 1, 3, 4) and `plan/context.md`
- [ ] T003 `ui/vocabulary.ts` with the glossary

## Phase 2: US1 — Words on screen

- [ ] T004 Label maps: `STAGE_LABELS`, agent titles, `STATUS_LABELS`, seniority, sections
- [ ] T005 Planning screens and stage bodies (Diagnóstico, Forma de trabajo, Componentes y recursos…)
- [ ] T006 Activities screen, task panel, filters, quick add, capacity, close stage, metas
- [ ] T007 Plan de trabajo views (Cronograma, Forma de trabajo, Componentes y recursos)
- [ ] T008 Team, profile, invitations, activity feed, toasts and empty states
- [ ] T009 Fake backend demo data in public-project words
- [ ] T010 Tests updated to the new texts; a scan of the demo's path for the "Today" words (SC-001)

## Phase 3: US2 — The agents plan public projects

- [ ] T011 `domain/plan.py` field descriptions (D4, D5)
- [ ] T012 Prompts: by stages, components and resources, activities A-n, Spanish public-project terms (with P2)
- [ ] T013 Mock planning data: the mangrove plan
- [ ] T014 `ProjectForm` without methodology; `requested_methodology: "scrum"` (D3)
- [ ] T015 Plan the mangrove description with the real key and in mock mode; check SC-004

## Phase 4: US3 — Evidence updates the plan

- [ ] T016 `complete` change: domain rules, `apply_replan`, tests
- [ ] T017 `ExpenseConfirmed` event from `ConfirmExpense` (with P1); feed text
- [ ] T018 `on_expense_confirmed` hook, Spanish reasons (D7), wiring in `main.py` (with P3), tests
- [ ] T019 Replan prompt and mock replan for evidence
- [ ] T020 Frontend: `complete` in `proposalContent.ts` and `ReplanDiff`; fake replan proposes it after a
  confirmed evidence; flow test (confirm photo → proposal → approve → activity finished)

## Phase 5: US4 — Hide software features

- [ ] T021 Issue badge, GitHub sections and fields, task type, WIP slots, documents and integrations links (D8)

## Phase 6: Polish

- [ ] T022 `pytest`, `npm run typecheck`, `npm run lint`, `npm test`; walk the demo's path on 390 px

## Dependencies & Execution Order

- T001 blocks phase 4's contract parts (T016–T020); phases 2, 3 and 5 can start at once.
- Phase 2 and phase 5 touch the same frontend files: one person, or split by folder.
- If time runs out: phases 2 and 3 are the demo; phase 4 next; phase 5 last.
