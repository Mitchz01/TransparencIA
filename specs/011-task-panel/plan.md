# Implementation Plan: 011 · Compact task panel

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Rewrite `TaskDrawer` as a document-style panel: the key, epic and type in the panel header, the title as heading text that turns into a field on focus, the properties as label/value rows whose value is a quiet menu or an inline field, and the description as text that turns into a text area. Each change calls `useTaskActions().update` with only its field, so the save button and the draft of the whole task go away. Two design system pieces are added for this: `PropertyRows`/`Property` and `InlineText`, plus a `header` slot on `Drawer`.

## Technical Context

**Language/Version**: TypeScript 6, React 19  
**Primary Dependencies**: the existing design system (`Menu`, `Pill`, `StateLabel`, `Avatar`, `Drawer`), TanStack Query through `useTaskActions`  
**Storage**: N/A  
**Testing**: Vitest + Testing Library against the fake gateways (`renderApp`)  
**Target Platform**: evergreen browsers, 360 px and up  
**Project Type**: web (frontend only)  
**Performance Goals**: a picked value shows at once; the save state appears in < 100 ms  
**Constraints**: no new endpoints or fields; same validation as today (`TASK_LIMITS`); design system rules (`check-design-rules.mjs`)  
**Scale/Scope**: one component rewritten, two design system components added

## Decisions

- **One PATCH per change, no draft.** `TaskPatch` already allows one field at a time, and `useTaskActions.update` already replaces the task in the board cache with the answer, so the card on the board updates by itself.
- **Save state is a counter of pending saves.** "Guardando" while it's above zero; "Guardado" after the last one finishes without errors; nothing after an error (the toast from `useApiErrorToast` already offers the retry).
- **`InlineText` commits on Enter (single line), on blur and on unmount.** Committing on unmount covers closing the panel while typing (FR-004). Escape reverts and stops the event, so the drawer only closes on a second Escape (FR-005). Multi-line text commits on blur or Ctrl/Cmd+Enter; Enter adds a line.
- **Properties use `Menu`** (keyboard and focus handling already exist) with the quiet variant, so the value reads as text until hovered or focused.
- **`Drawer` gets an optional `header`.** When given, it replaces the visible title and the dialog is named with `aria-label={title}`.

## Project Structure

### Documentation (this feature)

```text
specs/011-task-panel/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
frontend/
├── design-system/README.md                   # + Property rows, Inline text, Drawer header
└── src/ui/
    ├── components/ds/
    │   ├── Overlay.tsx                        # Drawer: optional `header`
    │   ├── Properties.tsx                     # NEW: PropertyRows, Property
    │   ├── InlineText.tsx                     # NEW: text that becomes a field
    │   └── index.ts                           # exports
    ├── components/board/TaskDrawer.tsx        # rewritten
    └── pages/TaskDrawer.test.tsx              # NEW
```

**Structure Decision**: frontend only, inside the existing `ds/` and `board/` folders.

## Phase 1: Setup

- [x] T001 Write spec 011 and this plan; add the spec to [specs/README.md](../README.md)

---

## Phase 2: Foundational

**Purpose**: the design system pieces the panel is built with

- [x] T002 Add `Property rows` and `Inline text` to [frontend/design-system/README.md](../../frontend/design-system/README.md), and the `header` slot to the Drawer row
- [x] T003 [P] Create `PropertyRows` and `Property` in `ds/Properties.tsx` (label with icon on the left, value on the right, no lines, space between rows)
- [x] T004 [P] Create `InlineText` in `ds/InlineText.tsx` (single and multi-line; reads as text, `inset` fill on hover and focus; commit on Enter, blur and unmount; Escape reverts; error under the field keeping the typed value)
- [x] T005 Add `header` to `Drawer` in `ds/Overlay.tsx`

---

## Phase 3: User Story 1 - Read a task at a glance (Priority: P1)

**Goal**: the panel reads like a page, not a form

**Independent Test**: open "Set up repo and CI" on the fake service: property rows, no boxed fields, no save button

- [x] T006 [US1] Rewrite the layout of `TaskDrawer`: header with key, epic and type; title; property rows (status, assignee, priority, points, issue); description; checklist; acceptance criteria
- [x] T007 [US1] Test: the rows show their values as text and there's no "Guardar cambios" button

---

## Phase 4: User Story 2 - Edit in place, saved automatically (Priority: P1)

**Goal**: each change is saved where it's made

**Independent Test**: change the priority, close, reopen: the change is there and the card shows it

- [x] T008 [US2] Wire each property to `update` with only its field; validate title and points before sending; show the save state ("Guardando", "Guardado")
- [x] T009 [US2] Test: picking a priority saves it and the card on the board changes
- [x] T010 [US2] Test: a title typed and left by closing the panel is saved; Escape puts the old one back
- [x] T011 [US2] Test: 150 points shows "Entre 0 y 100." and isn't sent

---

## Phase 5: User Story 3 - Warnings where they matter (Priority: P2)

**Goal**: warnings inside the value they affect

**Independent Test**: a task with `missing_role` shows "Falta DevOps" in its "Responsable" row

- [x] T012 [US3] Show the missing role in the "Responsable" row; keep the "Mover a revisión" suggestion
- [x] T013 [US3] Test: "Falta DevOps" in the row, gone after assigning someone

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T014 [P] Run `npm run lint`, `npm run typecheck` and `npm test`
- [ ] T015 [P] Manual pass at 360 and 1440 px in both themes and keyboard-only (spec 009, FR-010)

## Notes

- [Story] labels map tasks to user stories for traceability.
- No API change: [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md) stays as it is.
