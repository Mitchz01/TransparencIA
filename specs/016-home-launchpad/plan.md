# Implementation Plan: 016 · Home launchpad

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

A `HomeShell` (sidebar plus a rounded main panel) for the screens outside a project, and a new home: a `MeshHero` with an animated mango biche gradient, the greeting and a `ProjectComposer` that opens `/projects/new` prefilled, then a `ProjectsPanel` that overlaps the hero's bottom with generated covers and templates. Frontend only.

## Technical Context

**Language/Version**: TypeScript 6, React 19  
**Primary Dependencies**: Tailwind (tokens in `index.css`), the existing design system (`Menu`, `Popover`, `Segmented`, `Pill`, `Drawer`, `AgentSpark`)  
**Storage**: N/A  
**Testing**: Vitest + Testing Library on the fake gateways; a manual pass in both themes at desktop and 375 px  
**Constraints**: `check-design-rules.mjs`; the mesh moves only with `transform`  
**Scale/Scope**: one page rewritten, one page reframed, five new components, three pure functions

## API Contract

No new endpoints: `useProjects`, `useMe` and `useCreateProject` as today.

## Decisions

- **Mesh tokens** `mesh-1` to `mesh-6` (lime, mango biche, mango yellow, leaf green, deep green, cream) plus `on-mesh`. `mesh-5` is the gradient's top: `#1F3A12` in light, `#0A0B09` in dark, so the white greeting passes AA in both. A veil of `mesh-5` covers the top of the hero; the blobs bloom below it.
- **Blobs** are `radial-gradient`s already soft at the edges (no `filter: blur`), animated with `translate3d` and `scale`, 18 to 32 s, `alternate`. A static `feTurbulence` grain at 7% sits on top. The CSS lives in `index.css` next to the other utilities.
- **The composer exposes `focus()` and `fill(text)`** through a ref, so the sidebar, the templates and the empty state drive it without lifting its text into the page (typing doesn't re-render the panel).
- **Navigation state**: `/projects/new` receives `{ description, methodology, duration }` in the location state; outside the home, the sidebar's "Buscar" and "Proyectos" go to `/` with `{ focus }`.
- **Pure rules**: `recentProjects` and `suggestProjectName` in `domain/launchpad.ts`, `coverSeed` in `ui/components/home/cover.ts`, each with tests.
- **The mobile drawer** reuses `Drawer` (right side, opened from the menu button on the right), and is only mounted while open so the sidebar's controls aren't duplicated.
- **`Popover` gets `chevron`**, as `Menu` has, for the agents' pill.

## Project Structure

```text
frontend/
├── design-system/README.md                    # mesh tokens and the home exceptions
└── src/
    ├── domain/launchpad.ts (+ test)            # NEW recents, name suggestion
    ├── ui/styles/tokens.css, index.css          # mesh tokens, blobs, grain
    ├── ui/components/ds/Popover.tsx             # chevron prop
    ├── ui/components/ds/icons.ts                # new icons
    ├── ui/components/shell/HomeShell.tsx        # NEW
    ├── ui/components/home/                      # NEW MeshHero, ProjectComposer, ProjectsPanel, AgentsPill, cover.ts (+ test), templates.ts
    ├── ui/pages/ProjectsPage.tsx                # rewritten
    └── ui/pages/NewProjectPage.tsx              # HomeShell, prefill from state
```

## Phase 1: Setup

- [x] T001 Write spec 016 and this plan; add it to [specs/README.md](../README.md)

## Phase 2: Foundational

- [x] T002 Mesh tokens in `tokens.css` (three theme blocks) and `index.css`; blob, veil and grain utilities
- [x] T003 Pure rules with tests: `recentProjects`, `suggestProjectName`, `coverSeed`
- [x] T004 Design system README: mesh tokens and exceptions

## Phase 3: User Story 1 - Describe a project from the first screen (P1)

- [x] T005 `MeshHero` (blobs, veil, grain, pause while hidden)
- [x] T006 `ProjectComposer` (autosize, typewriter placeholder, methodology and duration menus, Enter sends)
- [x] T007 `NewProjectPage` prefilled from the location state, focus on the name
- [x] T008 Test: Enter on the home opens the form prefilled

## Phase 4: User Story 2 - Projects below the hero (P2)

- [x] T009 `ProjectsPanel`: tabs, search, covers, skeletons, empty state, templates

## Phase 5: User Story 3 - Move around outside a project (P3)

- [x] T010 `HomeShell` with sidebar, recents, invitation card and mobile drawer; used by home and new project
- [x] T011 Agents' pill with its popover

## Phase 6: Polish

- [x] T012 typecheck, lint, tests
- [ ] T013 Manual pass in both themes, desktop and 375 px (light desktop checked)
