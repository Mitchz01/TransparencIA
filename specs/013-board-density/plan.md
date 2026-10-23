# Implementation Plan: 013 · A board you read at a glance

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Make the board denser without new data: a `compact` page header (title and goal on one line, less padding), columns drawn as `lane` panels, and a smaller `TaskCard` (no description, one data row, priority as a state label instead of a pill, initials with the name for screen readers). New theme tokens keep the card the lightest layer in both themes: `lane` for the columns, `card` and `card-hover` for the cards, and `card-inset` for what sits inside a card.

## Technical Context

**Language/Version**: TypeScript 6, React 19  
**Primary Dependencies**: Tailwind (tokens mapped in `index.css`), the existing design system (`StateLabel`, `Avatar`, `ProgressTrack`), dnd-kit  
**Storage**: N/A  
**Testing**: Vitest + Testing Library against the fake gateways; a manual pass in the browser at 1536×864 and 360 px  
**Target Platform**: evergreen browsers, 360 px and up  
**Project Type**: web (frontend only)  
**Performance Goals**: no change; the card renders less than today  
**Constraints**: design system rules (`check-design-rules.mjs`); 4.5:1 for every text on the new backgrounds  
**Scale/Scope**: three board components, the page header, two theme tokens

## Decisions

- **New tokens instead of reusing `surface-strong`.** In light, cards are white on a grey column; in dark, the column is `surface` and the card has to be lighter than it, so the card can't be `surface` in both themes. Values, checked for 4.5:1 with every text color that goes on them:

  | Token | Light | Dark |
  |---|---|---|
  | `lane` | `#EDEFE8` | `#141612` |
  | `card` | `#FFFFFF` | `#22261E` |
  | `card-hover` | `#F4F5F0` | `#2B3026` |
  | `card-inset` | `#E8EAE2` | `#383D31` |

  `ink-subtle` doesn't pass on a dark `card` (4.45), so card text uses `ink-muted` or `ink`. On a light `lane`, the amber WIP warning passes at 4.52.
- **Cards inside a column are blocks inside a panel**: `radius-md`, `space-4` padding, `space-2` between them. The column keeps `radius-lg`.
- **Priority as `StateLabel`** (flag icon plus word in its hue, no fill). The pill was the loudest thing on every card.
- **The assignee is initials only**, with the full name in `title` and in a visually hidden span, since `Avatar` is hidden from screen readers. On a card the initials and the checklist track use `card-inset`: `surface-strong` is the dark `card` itself, so they would disappear. `cn` doesn't merge classes, so the override uses `!` (as `bg-surface!` in the filters).
- **The column scroller is `relative`**, so the screen reader text inside cards (absolutely positioned) is clipped by it and doesn't widen the page at 360 px.
- **The drop highlight is `primary-soft`**: `surface-strong` is too close to `lane` to notice.
- **`PageHeader` gets `compact`**: title and description on one baseline, padding `pt-2 pb-4` (`md:pt-4`). Only the board uses it.

## Project Structure

### Documentation (this feature)

```text
specs/013-board-density/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
frontend/
├── design-system/README.md                  # + lane, card, card-hover, card-inset; board column and task card rows
└── src/ui/
    ├── styles/tokens.css                     # + lane, card, card-hover, card-inset (light, dark, system dark)
    ├── styles/index.css                      # map the new colors
    ├── components/shell/PageHeader.tsx       # compact
    ├── components/board/Column.tsx           # lane panel
    ├── components/board/KanbanBoard.tsx      # smaller gap between columns
    ├── components/board/TaskCard.tsx         # compact card
    ├── components/ds/Avatar.tsx              # comment: the name can be screen reader text
    ├── pages/BoardPage.tsx                   # compact header, filters spacing
    └── pages/BoardPage.test.tsx              # NEW
```

**Structure Decision**: frontend only, inside the existing `styles/`, `shell/` and `board/` folders.

## Phase 1: Setup

- [x] T001 Write spec 013 and this plan; add the spec to [specs/README.md](../README.md)

---

## Phase 2: Foundational

**Purpose**: the backgrounds the columns and cards use

- [x] T002 Add `lane`, `card`, `card-hover` and `card-inset` to `tokens.css` (all three theme blocks) and to `index.css`
- [x] T003 Document the tokens, the board column and the task card in [frontend/design-system/README.md](../../frontend/design-system/README.md)

---

## Phase 3: User Story 1 - See the sprint's work as soon as the board opens (Priority: P1)

**Goal**: short header, columns as panels, compact cards

**Independent Test**: "Tienda online" at 1536×864: first card in the top 250 px, cards at most 120 px tall

- [x] T004 [US1] Add `compact` to `PageHeader` and use it on the board; filters at `mb-4`
- [x] T005 [US1] Draw `Column` as a `lane` panel with its header inside, the empty state in `ink-muted` and the drop highlight in `primary-soft`
- [x] T006 [US1] Rewrite `TaskCard`: title in two lines, progress when partly done, one data row with key, checklist, points, issue, priority and assignee or missing role
- [x] T007 [US1] Test: a card shows its priority word and the assignee's name for screen readers, and not the description

---

## Phase 4: User Story 2 - The same board in dark mode and on a phone (Priority: P2)

**Goal**: the backgrounds step up in both themes; the narrow layout still scrolls

**Independent Test**: dark theme and 360 px in the browser

- [ ] T008 [US2] Manual pass: dark theme, 360 px, drag over a column (dark and 360 px checked; the drag highlight is still to check by hand)

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T009 [P] Run `npm run lint`, `npm run typecheck` and `npm test`
- [x] T010 [P] Measure SC-001 to SC-003 at 1536×864 in the browser

## Notes

- [Story] labels map tasks to user stories for traceability.
- No API change: [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md) stays as it is.
