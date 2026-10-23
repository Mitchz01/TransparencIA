# Implementation Plan: 012 · Visual plan views

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

Redraw the three parts of the plan screen with the data spec 004 already returns. The roadmap becomes a week grid with phase and epic bars filled by progress, a highlighted column for the current week and milestones at the end of each phase. The methodology becomes two flows: the ceremonies in the order they happen ending with how the iteration repeats, and the board columns with their WIP limits as slots. The architecture becomes a map of the stack layers with the components that share their technology inside each one, and the decisions fold. The pure parts (ceremony order, matching components to layers) live in `src/domain/planViews.ts` and are unit tested.

## Technical Context

**Language/Version**: TypeScript 6, React 19  
**Primary Dependencies**: the existing design system and icon set; no chart library (the bars are CSS grid cells)  
**Storage**: N/A  
**Testing**: Vitest + Testing Library against the fake gateways (`renderApp`); unit tests for the pure rules  
**Target Platform**: evergreen browsers, 360 px and up  
**Project Type**: web (frontend only)  
**Performance Goals**: each view renders in < 50 ms for 12 weeks and 20 epics  
**Constraints**: no new endpoints or fields; design system rules (no separator lines, at most three numbers per screen, states as icon plus word)  
**Scale/Scope**: three components rewritten, one design system addition (timeline, flow, slots)

## Decisions

- **Timeline as a CSS grid, not a chart library.** One column for names (sticky on scroll) plus one per week; each bar spans `start_week` to `end_week`. The current week is one extra cell spanning every row in `primary-soft`, drawn behind the bars, so it's a highlighted column, not a line (design rule 2).
- **Epics share their phase's weeks.** The roadmap gives weeks per phase only; an epic's bar spans its phase and its fill shows its own progress.
- **Ceremony order is a known sequence**: planning, daily or stand-up, review or demo, retro; unknown names keep the agent's order after the known ones (`orderCeremonies`).
- **Components go into a layer by shared technology words** (`groupByLayer`): the technology strings are split into lowercase words of 3+ letters, ignoring generic words ("app", "api" are kept); the first layer that shares a word wins. Unmatched ones go to "Otras piezas". It's a reading aid, not a claim about how the system is wired, so there are no arrows.
- **Decisions use `<details>`**, which already opens with Enter and Space and is announced as expandable.
- **`ProgressTrack` gets a `size`** (`sm` 6 px as today, `md` 12 px for timeline bars), so the timeline reuses its role, label and fill.

## Project Structure

### Documentation (this feature)

```text
specs/012-visual-plan-views/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
frontend/
├── design-system/README.md                    # + Timeline, Flow, Slots, Disclosure row
└── src/
    ├── domain/planViews.ts                     # + orderCeremonies, groupByLayer
    ├── domain/planViews.test.ts                # NEW
    └── ui/components/
        ├── ds/ProgressTrack.tsx                # + size
        ├── ds/icons.ts                         # + icons for components and flows
        └── plan/
            ├── RoadmapTimeline.tsx             # rewritten as a timeline
            ├── MethodologyView.tsx             # rewritten as two flows
            └── ArchitectureView.tsx            # rewritten as a layer map
    └── ui/pages/PlanPage.test.tsx              # + one test per view
```

**Structure Decision**: frontend only; pure rules in `domain/`, drawing in `ui/components/plan/`.

## Phase 1: Setup

- [x] T001 Write spec 012 and this plan; add the spec to [specs/README.md](../README.md)

---

## Phase 2: Foundational

- [x] T002 Add `Timeline`, `Flow`, `Slots` and `Disclosure row` to [frontend/design-system/README.md](../../frontend/design-system/README.md)
- [x] T003 [P] Add `size` to `ProgressTrack`
- [x] T004 [P] Add `orderCeremonies` and `groupByLayer` to `src/domain/planViews.ts`, with unit tests

---

## Phase 3: User Story 1 - The roadmap as a timeline (Priority: P1)

**Goal**: phases and epics as bars over the weeks, today highlighted, milestones at the end of each phase

**Independent Test**: demo project in week 3: "Bases" over weeks 1 and 2, week 3 highlighted, the "Bases" milestone with its deliverables

- [x] T005 [US1] Rewrite `RoadmapTimeline`: keep the summary card; week grid with sticky names, phase and epic bars, current week column, milestones
- [x] T006 [US1] Test: the bars read their weeks and progress, the current week is marked, the milestone lists the deliverables

---

## Phase 4: User Story 2 - The methodology as a flow (Priority: P2)

**Goal**: the iteration and the board as flows

**Independent Test**: demo project: Planning, Daily, Retro, "Se repite cada 2 semanas"; 3 slots in "En curso"

- [x] T007 [US2] Rewrite `MethodologyView`: header as today, iteration flow, board flow with slots, discarded alternatives
- [x] T008 [US2] Test: ceremony order, repeat text and slots

---

## Phase 5: User Story 3 - The architecture as a map (Priority: P2)

**Goal**: components inside their stack layer, decisions folded

**Independent Test**: demo project: "App web" in Frontend, "Base de datos" in "Otras piezas", a decision opens

- [x] T009 [US3] Rewrite `ArchitectureView`: layer map, "Otras piezas", folded decisions
- [x] T010 [US3] Test: components in their layers and a decision that opens

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 [P] Run `npm run lint`, `npm run typecheck` and `npm test`
- [ ] T012 [P] Manual pass at 360, 768 and 1440 px in both themes (SC-002)
- [ ] T013 Later, outside this spec: let the architecture stage return which component talks to which (spec 002 output schema, spec 004 view) to draw arrows

## Notes

- [Story] labels map tasks to user stories for traceability.
- No API change: [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md) stays as it is.
