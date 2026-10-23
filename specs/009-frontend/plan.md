# Implementation Plan: 009 · Frontend

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Build every screen of the product as a React SPA on top of what PR #16 already provides (API client, `ApiError`, the project, proposal and activity gateways with real and fake adapters, and the SSE event stream). This plan adds the app shell (router, gateway container, theme, top bar), the design system components, server-state caching with live invalidation from SSE, the remaining gateways (planning, board, documents, integrations) with their fake adapters, and then the screens story by story: new project, planning with proposals, board, plan views, activity, projects and settings, documents, integrations, and replanning. A fake planning engine in the fake store simulates the agents so the whole demo runs without a backend (FR-007). Design rules are checked by a script in CI.

## Technical Context

**Language/Version**: TypeScript 6, React 19  
**Primary Dependencies**: Vite 8, React Router 7, Tailwind 4 (`@tailwindcss/vite`) mapped to `src/ui/styles/tokens.css`, TanStack Query 5 (server state), `@dnd-kit/core` + `@dnd-kit/sortable`, the project's icon set (`@hugeicons/react`), `@fontsource-variable/geist`, `react-markdown`, `mermaid`  
**Storage**: none on the server side of the frontend; the theme choice in `localStorage` (wrapped in try/catch)  
**Testing**: Vitest + Testing Library (jsdom) for domain rules, hooks and key flows against the fake gateways; `tsc -b`; `oxlint`; `scripts/check-design-rules.mjs`  
**Target Platform**: evergreen desktop browsers first, usable down to 360px wide  
**Project Type**: web (frontend of the existing backend)  
**Performance Goals**: card moves render in < 100 ms (SC-003); first content of each screen < 2 s (SC-005)  
**Constraints**: only the API contract, never `fetch` from UI code; only design system components and tokens; light and dark themes; keyboard support everywhere (FR-010); 4.5:1 contrast (FR-011)  
**Scale/Scope**: 9 screens, ~30 components, up to ~100 cards on a board

## Project Structure

### Documentation (this feature)

```text
specs/009-frontend/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
frontend/
├── index.html
├── vite.config.ts                          # + tailwind plugin, vitest config
├── scripts/check-design-rules.mjs          # NEW: fails on forbidden patterns
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx                         # providers: query client, gateways, theme
    │   ├── routes.tsx                      # all routes
    │   ├── container.tsx                   # NEW: GatewaysProvider (http or fake by VITE_USE_FAKE)
    │   └── theme.tsx                       # NEW: ThemeProvider (system default, remembered choice)
    ├── domain/
    │   ├── project.ts, proposals.ts, events.ts, planViews.ts   # from PR #16
    │   ├── board.ts, plan.ts, documents.ts, integrations.ts    # aligned with the contract
    │   ├── proposalContent.ts              # NEW: content shape per proposal kind and key
    │   ├── stepper.ts                      # NEW: deriveStepper() (see API Contract)
    │   └── rules.ts                        # NEW: form rules, WIP, capacity mirror, checklist progress, filters
    ├── application/
    │   ├── ports.ts, errors.ts             # from PR #16; + Planning/Board/Document/Integration gateways
    │   ├── queryKeys.ts                    # NEW: one key per resource
    │   ├── liveUpdates.ts                  # NEW: event type → query keys to invalidate
    │   └── use-cases/                      # hooks: useProjects, useProject, useCreateProject,
    │                                       #   usePlanning, useProposals, useBoard, useMoveTask,
    │                                       #   usePlanViews, useActivity, useDocuments, useIntegrations
    ├── adapters/
    │   ├── http/                           # from PR #16; + planning, board, document, integration gateways
    │   └── fake/                           # from PR #16; + the same four, fakePlanning engine, demo board
    └── ui/
        ├── styles/index.css, tokens.css
        ├── components/
        │   ├── ds/                         # Button, IconButton, Icon, Pill, Chip, Segmented, Card,
        │   │                               #   TextField, TextArea, Select, NumberField, Dialog, Drawer,
        │   │                               #   Toast, Avatar, ProgressTrack, Tooltip, EmptyState, Skeleton
        │   ├── shell/                      # TopBar, SectionNav, ProjectSwitcher, AppLayout
        │   ├── project/                    # ProjectForm, MemberRows
        │   ├── planning/                   # StageStepper, ProposalCard, stage bodies, AdjustEditor, RejectDialog
        │   ├── board/                      # KanbanBoard, Column, TaskCard, TaskDrawer, Checklist,
        │   │                               #   SprintSelector, CapacityBar, BoardFilters, CloseSprintButton
        │   ├── plan/                       # RoadmapTimeline, MethodologyView, ArchitectureView, ViewOrigin
        │   ├── activity/                   # ActivityDrawer, ActivityItem
        │   ├── documents/                  # MarkdownView, MermaidView, VersionHistory, RegenerateDialog, DocumentEditor
        │   ├── integrations/               # RepositoryForm, MemberGithubUsers, IssueBadge, TestModeBanner
        │   └── replan/                     # ReplanDialog, ReplanDiff
        └── pages/                          # ProjectsPage, NewProjectPage, PlanningPage, BoardPage, PlanPage,
                                            #   DocumentsPage, IntegrationsPage, SettingsPage, NotFoundPage
```

**Structure Decision**: the existing frontend hexagonal layout. `ui → application → domain`; `adapters` implement `application/ports.ts` and only `app/container.tsx` imports them. Design system components live in `ui/components/ds/` and are the only place that touches tokens directly; feature components compose them.

### Decisions

| Decision | Discarded alternative | Why |
|---|---|---|
| TanStack Query for server state, invalidated by SSE events | Hand-written `useEffect` fetching | The contract says "events tell you what changed, refetch"; query invalidation per event is exactly that, with caching and optimistic updates for board moves |
| Tailwind utilities mapped to the tokens with `@theme` | Plain CSS modules | Fast to build, and the tokens stay the single source of colors |
| Stepper state derived on the client | A new `GET /planning` endpoint | Everything needed is already in the project, its proposals and the activity; no backend change |
| Font bundled with the app | Loading it from the web | The demo can't depend on the venue's network |
| Fake planning engine inside the fake store | Recorded demo data only | The demo needs live progress, approvals and the board appearing, without a backend |
| A script that checks the design rules | Only manual review | The rules are absolute (spec FR-002); a script catches regressions on every commit |

## API Contract

This spec adds no endpoints. It consumes [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md) as is, with two clarifications:

**Stepper state** (`domain/stepper.ts`, `deriveStepper(project, proposals, activity)`), per stage key in order:

| Stage state | Rule |
|---|---|
| `approved` | Its newest `plan_stage` proposal is `approved` or `adjusted` |
| `waiting` | Its newest proposal is `pending` |
| `needs_leader` | Its 3 newest proposals are `rejected` with no approval in between, or a `stage_needs_leader` event for it is newer than its newest proposal |
| `failed` | `project.status === 'error'` and it's the first stage that isn't approved; the reason is the newest `plan_failed` event's `error` |
| `working` | `project.status === 'planning'`, it's the first stage that isn't approved, and it isn't waiting, failed or needing the leader |
| `not_started` | Anything else |

**Proposal content by kind**: the shapes for `document` (006), `github_action` `create_issues` / `request_review` (007) and `replan` (008) are defined in those plans but not yet in the contract. Task T014 copies them into section 3 of `api-contract.md` and `domain/proposalContent.ts`; their owners review that PR.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, styling and the empty app shell

- [ ] T001 Install Tailwind 4 with `@tailwindcss/vite`, `@tanstack/react-query`, `@dnd-kit/sortable`, `@fontsource-variable/geist`, `react-markdown`, `mermaid`, and as dev dependencies `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`
- [ ] T002 Add the Tailwind plugin and the Vitest config to `frontend/vite.config.ts` (and translate its leftover comment to English)
- [ ] T003 In `frontend/src/ui/styles/index.css`: import Tailwind, `tokens.css` and the font; map every token with `@theme` (colors `bg`, `surface`, `surface-strong`, `ink*`, `primary*`, `accent-ink`, `inverse`, the five hues and their soft fills, `chart-*`; radii; font family; text sizes); base styles (body background `bg`, `ink` text, tabular numbers utility, focus ring, reduced motion)
- [ ] T004 Remove the Vite template (`App.css`, template assets and markup) from `frontend/src/app/` and `frontend/src/ui/assets/`
- [ ] T005 [P] Create `frontend/scripts/check-design-rules.mjs` and add it to `npm run lint`: fail on em dashes, the `·` separator, emoji ranges, `border-l`/`border-r` and `divide-` classes, `<hr`, `uppercase`, and small round status dots (`rounded-full` with `w-1`…`w-3`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: providers, design system components, shell, live updates and the missing gateways

**CRITICAL**: no user story work can begin until this phase is complete. Requires PR #16 merged.

- [ ] T006 Create `frontend/src/app/container.tsx` (`GatewaysProvider`, `useGateways`; `createFakeGateways()` when `VITE_USE_FAKE=true`, `createHttpGateways()` otherwise) and `frontend/src/app/theme.tsx` (`data-theme` on `<html>`, system preference by default, remembered choice, toggle)
- [ ] T007 Create `frontend/src/app/App.tsx` (QueryClient, GatewaysProvider, ThemeProvider) and `frontend/src/app/routes.tsx` with every route of the screen map and a `NotFoundPage`
- [ ] T008 [P] Build the base design system components in `frontend/src/ui/components/ds/`: `Icon` (20/24 px, `currentColor`), `Button` (primary, secondary, quiet; sizes sm/md/lg; loading state), `IconButton` (with required `aria-label`), `Pill` (hue + icon + word), `Chip` (pressed state), `Segmented`, `Card`, `Avatar` (initials), `ProgressTrack`
- [ ] T009 [P] Build the form and overlay components in `frontend/src/ui/components/ds/`: `TextField`, `TextArea`, `Select`, `NumberField` (label, hint, error under the field, `aria-invalid` + `aria-describedby`), `Dialog`, `Drawer` (focus trap, Escape, `shadow-float`), `Toast` (message + retry + request id), `Tooltip`, `EmptyState`, `Skeleton`
- [ ] T010 [P] Unit tests for `Pill`, `Button` and `TextField` accessibility (names, error wiring) in `frontend/src/ui/components/ds/ds.test.tsx`
- [ ] T011 Build the shell in `frontend/src/ui/components/shell/`: `AppLayout`, `TopBar` with `ProjectSwitcher` (left), `SectionNav` pill group (center, active section in `primary`), and activity, theme and settings icon buttons (right); collapses the sections into a menu under 768px
- [ ] T012 Create `frontend/src/application/queryKeys.ts` and `frontend/src/application/liveUpdates.ts`: `useLiveUpdates(projectId)` subscribes to `EventStream` (with `after` = newest loaded `seq`) and invalidates the keys from the contract's "What to refetch per event" table; `resync` invalidates everything for the project
- [ ] T013 Create `frontend/src/application/use-cases/useApiErrorToast.ts`: maps each error `code` to the UI reaction in the contract's error table (toast with request id, refetch, field errors)
- [ ] T014 Add "Proposal content by kind" to section 3 of `frontend/docs/api-contract.md` (from the plans of 006, 007, 008) and mirror it in `frontend/src/domain/proposalContent.ts`
- [ ] T015 Add `PlanningGateway`, `BoardGateway`, `DocumentGateway` and `IntegrationGateway` to `frontend/src/application/ports.ts` exactly as the contract's section 4; implement them in `frontend/src/adapters/http/` and register them in `createHttpGateways()`
- [ ] T016 Implement the same four in `frontend/src/adapters/fake/`, plus `fakePlanning.ts`: `start` publishes `agent_started`, waits ~1.2 s, creates the stage proposal from the demo plan with `agent_finished` + `proposal_created`; approving a stage starts the next; auto-approve chains them; approving `sprints` builds the demo board, publishes `plan_applied` and creates the document proposals
- [ ] T017 [P] Tests for the fake planning engine (stage order, auto-approve, board built after sprints, events with increasing `seq`) in `frontend/src/adapters/fake/fakePlanning.test.ts`

**Checkpoint**: the app opens on the fake service with the shell, theme toggle and live updates working

---

## Phase 3: User Story 1 - Create a project and start planning (Priority: P1), MVP

**Goal**: form with team rows, client validation mirroring the service, then start planning and land on the planning screen

**Independent Test**: on the fake service, create a project with two members and land on the planning screen with the first stage working

### Tests for User Story 1

- [ ] T018 [P] [US1] Tests for the project form rules (contract section 4 validation table, unique names case-insensitive, defaults) in `frontend/src/domain/rules.test.ts`
- [ ] T019 [P] [US1] Flow test: fill the form, duplicate name shows under the second row, fix it, save → navigates to `/projects/:id/planning`, in `frontend/src/ui/pages/NewProjectPage.test.tsx`

### Implementation for User Story 1

- [ ] T020 [US1] Add `validateProject()` to `frontend/src/domain/rules.ts` returning errors keyed by the contract's field paths (`members[1].name`)
- [ ] T021 [US1] Create `MemberRows` (add/remove rows, role, seniority, hours, skills as chips) and `ProjectForm` (name, description, duration, methodology select, auto-approve switch) in `frontend/src/ui/components/project/`
- [ ] T022 [US1] Create `useCreateProject` (create → `planning.start` → navigate; 422 errors mapped to fields) and `NewProjectPage` at `/projects/new`

**Checkpoint**: a project can be created and planning starts from the UI

---

## Phase 4: User Story 2 - Follow the planning and decide on each proposal (Priority: P1)

**Goal**: live stepper, the waiting proposal with its rationale, approve, adjust, reject with reason, retry

**Independent Test**: on the fake service, go through the six stages approving one, adjusting one and rejecting one; the board opens after the last approval

### Tests for User Story 2

- [ ] T023 [P] [US2] Tests for `deriveStepper` (every row of the stepper state table) in `frontend/src/domain/stepper.test.ts`
- [ ] T024 [P] [US2] Flow test on the fake service: approve, adjust (iteration length), reject without reason blocked, reject with reason, stage needing the leader, in `frontend/src/ui/pages/PlanningPage.test.tsx`

### Implementation for User Story 2

- [ ] T025 [US2] Implement `deriveStepper` in `frontend/src/domain/stepper.ts` and `usePlanning(projectId)` (project + proposals + recent activity → stepper; `start`, `retryStage`)
- [ ] T026 [US2] Create `StageStepper` in `frontend/src/ui/components/planning/`: six rows, each with the agent name and its state as icon + word (Working, Waiting for you, Approved, Needs you, Failed); no circles or connecting lines
- [ ] T027 [US2] Create `ProposalCard` (agent, title, state pill, rationale block in `primary-soft`, actions) and one body per stage (`AnalysisBody`, `MethodologyBody`, `ArchitectureBody`, `RoadmapBody`, `BacklogBody`, `SprintsBody`), at most three facts each
- [ ] T028 [US2] Create `AdjustEditor`: editable fields per stage (methodology, iteration length and WIP limits; roadmap phase names and weeks; story points and priority; sprint assignments), sending the whole content; 422 `content.*` paths mapped to fields
- [ ] T029 [US2] Create `RejectDialog` (reason required, 1–1000 chars) and the "Applying" and "Retry" states from `apply_failed`
- [ ] T030 [US2] Create `PlanningPage` at `/projects/:id/planning`: stepper beside the current proposal, "Start planning" / "Retry" actions, auto-approve notice, and "Open the board" once `plan_applied` arrives

**Checkpoint**: User Stories 1 and 2 work end to end on the fake service

---

## Phase 5: User Story 3 - Work on the board (Priority: P1)

**Goal**: sprint board with drag and drop, task drawer with checklist, sprint selector with load, warnings, Kanban mode, filters

**Independent Test**: on the fake service, move a card to another column, reload, and see it where it was left

### Tests for User Story 3

- [ ] T031 [P] [US3] Tests for `wipWarnings`, `sprintLoad`, `checklistProgress` and `filterTasks` in `frontend/src/domain/rules.test.ts`
- [ ] T032 [P] [US3] Tests for `useMoveTask`: optimistic update, revert and toast on failure, warnings kept, in `frontend/src/application/use-cases/useMoveTask.test.tsx`

### Implementation for User Story 3

- [ ] T033 [US3] Add the board rules to `frontend/src/domain/rules.ts` (capacity mirrors spec 002's rule) and create `useBoard` and `useMoveTask` (TanStack Query optimistic mutation)
- [ ] T034 [US3] Create `KanbanBoard`, `Column` (name + count in words, add button, WIP warning as icon + word) and `TaskCard` (title, description cut to two lines, key and points with tabular numbers, checklist progress, assignee or "Missing role", priority pill) in `frontend/src/ui/components/board/`
- [ ] T035 [US3] Wire dnd-kit: pointer and keyboard sensors, `SortableContext` per column, drag overlay with `shadow-float` and a slight tilt, announcements for screen readers
- [ ] T036 [US3] Create `TaskDrawer` and `Checklist` (edit fields, check/add/edit/remove items, "Move to review?" suggestion)
- [ ] T037 [US3] Create `SprintSelector` (defaults to the first sprint with unfinished work), `CapacityBar` (points vs capacity, overload warning, capacity override) and `BoardFilters` (mine, priority, epic; kept in the URL)
- [ ] T038 [US3] Create `BoardPage` at `/projects/:id/board`, with the continuous layout when `continuous` is true and an empty state linking to planning when there's no board yet

**Checkpoint**: the round 1 demo (project → plan → approval → board) works end to end on the fake service

---

## Phase 6: User Story 4 - See the plan (Priority: P2)

**Goal**: roadmap timeline with progress, methodology and architecture, each with its origin

**Independent Test**: with an approved plan on the fake service, open the plan and see the three parts with their origin

### Implementation for User Story 4

- [ ] T039 [P] [US4] Create `ViewOrigin` (agent, rationale, approval date in words, how it was approved) and the "not generated yet" / "waiting for approval" states linking to the proposal, in `frontend/src/ui/components/plan/`
- [ ] T040 [US4] Create `RoadmapTimeline`: phases as blocks across a week grid, epics inside with their progress track, the current week highlighted with a fill (no lines)
- [ ] T041 [US4] Create `MethodologyView` (decision, iteration, ceremonies, WIP limits, discarded alternatives, chosen by leader or agents) and `ArchitectureView` (style, components, stack, decisions)
- [ ] T042 [US4] Create `PlanPage` at `/projects/:id/plan` with a segmented control for Roadmap, Methodology and Architecture, fed by `usePlanViews`

**Checkpoint**: User Stories 1–4 work independently

---

## Phase 7: User Story 5 - Follow the activity (Priority: P2)

**Goal**: live activity drawer with history and links

**Independent Test**: with the drawer open, approve a proposal in another tab; the item appears at the top without reloading

### Implementation for User Story 5

- [ ] T043 [US5] Create `useActivity` (infinite query with `before`, prepends live events from `useLiveUpdates`)
- [ ] T044 [US5] Create `ActivityItem` (actor icon, `summary`, time in words, link from `ref`) and `ActivityDrawer` (opened from the top bar on every project screen)
- [ ] T045 [P] [US5] Test reconnection with `after` and `resync` against the fake stream in `frontend/src/application/liveUpdates.test.ts`

**Checkpoint**: User Stories 1–5 work independently

---

## Phase 8: User Story 6 - Manage projects and settings (Priority: P2)

**Goal**: projects list, settings with the same form, locked methodology explained

**Independent Test**: open an existing project from the list, change a member's hours in settings and see it saved

### Implementation for User Story 6

- [ ] T046 [US6] Create `ProjectsPage` at `/`: project cards (name, status pill, duration, member count) and "New project"
- [ ] T047 [US6] Create `SettingsPage` at `/projects/:id/settings` reusing `ProjectForm` in edit mode (`PATCH` with only the changed fields; methodology disabled with a short reason when not in draft; `methodology_locked` handled)

**Checkpoint**: User Stories 1–6 work independently

---

## Phase 9: User Story 7 - Read and maintain the documents (Priority: P3)

**Goal**: specs and diagrams rendered, versions, regenerate, edit with conflict handling

**Independent Test**: regenerate the general spec with an instruction, approve the new proposal and see version 2 with version 1 still available

### Implementation for User Story 7

- [ ] T048 [P] [US7] Create `MarkdownView` (themed typography) and `MermaidView` (themed render; shows the source with a message when it can't be drawn)
- [ ] T049 [US7] Create `VersionHistory`, `RegenerateDialog` and `DocumentEditor` (sends `base_version`; `version_conflict` offers reload or copy)
- [ ] T050 [US7] Create `DocumentsPage` at `/projects/:id/documents`: general spec, epic specs grouped by phase, diagrams, outdated badge with a regenerate shortcut

**Checkpoint**: User Stories 1–7 work independently

---

## Phase 10: User Story 8 - Connect GitHub and publish issues (Priority: P3)

**Goal**: repo connection, members' GitHub users, publish issues, issue badges, test mode banner

**Independent Test**: connect a repo on the fake service, publish the tasks and see each card with its issue number

### Implementation for User Story 8

- [ ] T051 [P] [US8] Create `RepositoryForm` (`owner/name` pattern from the contract, write-only token field showing only "Token saved", replace confirmation, `repository_not_accessible` reasons in plain words) and `TestModeBanner`
- [ ] T052 [US8] Create `MemberGithubUsers` (with the "can't see the repo yet" warning) and the `create_issues` and `request_review` proposal bodies
- [ ] T053 [US8] Create `IntegrationsPage` at `/projects/:id/integrations` with "Publish pending tasks", and add `IssueBadge` to `TaskCard`

**Checkpoint**: User Stories 1–8 work independently

---

## Phase 11: User Story 9 - Replan and close sprints (Priority: P3)

**Goal**: ask for a replan, review its changes and drop some, close a sprint

**Independent Test**: ask for a replan on the fake service, drop one change and approve; the board shows the rest applied

### Implementation for User Story 9

- [ ] T054 [P] [US9] Create `ReplanDialog` (reason 1–1000 chars) and `CloseSprintButton` (end date in words, warning when it's past)
- [ ] T055 [US9] Create `ReplanDiff`: changes grouped by kind, each with its rationale and a toggle to drop it; approving with dropped changes sends `adjust` with the remaining ones
- [ ] T056 [US9] Add both actions to the board header and the `replan` body to `ProposalCard`; extend `fakePlanning.ts` with a sample replan

**Checkpoint**: all user stories work independently

---

## Phase 12: Polish & Cross-Cutting Concerns

- [ ] T057 [P] Review every screen in both themes against the design rules (SC-004) with `check-design-rules.mjs` plus a manual pass; fix findings
- [ ] T058 [P] Accessibility pass: keyboard-only run of the demo flow, focus order in drawers and dialogs, accessible names, contrast spot checks
- [ ] T059 [P] Responsive pass at 360, 768 and 1440 px
- [ ] T060 Time the demo on the fake service (SC-001) and the first content per screen (SC-005); fix the slow ones
- [ ] T061 Document `VITE_USE_FAKE` and the frontend scripts in `README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs PR #16 merged; blocks every story
- **User stories**: P1 stories (US1 → US2 → US3) in order, since each one is the entry to the next in the demo; P2 and P3 stories can go in parallel after US3
- **Polish**: after the desired stories

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: independent of US1 on the fake service (seeded project); the demo flow chains them
- **US3 (P1)**: independent on the fake service (seeded board after T016)
- **US4, US5, US6 (P2)**: after Foundational; independent of each other
- **US7, US8, US9 (P3)**: after Foundational; US8's `IssueBadge` and US9's actions extend US3's board

### Cross-spec dependencies

- **001, 004, 005**: PR #16 provides their gateways and fake adapters; this plan only consumes them.
- **002, 003, 006, 007, 008**: their endpoints come from the contract; until a backend lands, the fake adapter covers it. Their plans' screen tasks are owned here.
- **Contract changes**: any field or endpoint a screen needs goes into the owner's plan and `api-contract.md` first (specs/README.md contract `001–008 → 009`).

### Within Each User Story

- Domain rules before hooks
- Hooks before components
- Components before the page

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable on the fake service
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
