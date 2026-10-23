# Implementation Plan: Monorepo with a separate public portal

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

Move `backend/` to `apps/api/` and `frontend/` to `apps/team/`, add `apps/portal/` (a new Vite + React
app for `/p/:slug`), and extract the design system to `packages/ui` and the transparency shapes to
`packages/domain`. npm workspaces tie the frontends together; the backend stays a Python app with its own
virtualenv.

## Technical Context

**Language/Version**: Python 3.13; TypeScript 6 + React 19  
**Primary Dependencies**: npm workspaces (no new tool)  
**Testing**: pytest, vitest, `tsc -b`, oxlint + the design rules check

### Decisions

- **D1 — npm workspaces**, not pnpm/Turborepo/moon: the repo already uses npm; nothing new to install
  or learn mid-hackathon.
- **D2 — Two frontends, one backend.** The portal only calls `/api/public/*` and `/api/files/*`; a second
  backend would duplicate persistence and wiring for no gain.
- **D3 — Shared packages are source, not built.** `exports` point at `.ts`/`.css` files; Vite and `tsc`
  compile them as part of each app. No build step, no watch.
- **D4 — `@agile/ui`** holds the design system: tokens, the Tailwind theme (`theme.css`), the components
  of `ds/` and the design system README and preview. `Toaster` stays in the team app because it reads the
  team's toast context. The theme declares `@source` on its own folder so each app's Tailwind generates
  the package's classes.
- **D5 — `@agile/domain`** holds the shapes both apps read: the transparency types of spec 017 (team
  README, "Shared interfaces"). Types only one app uses stay in that app's `src/domain/`.
- **D6 — Ports**: team app on `:5173`, portal on `:5174`, both proxy `/api` to `:8000`. The QR of spec 017
  points at the portal (`PUBLIC_APP_URL`), and the tunnel of spec 017 D10 exposes `:5174`.
- **D7 — The design rules check moves to the root** (`scripts/check-design-rules.mjs`) and scans the
  folder it's run from, so each workspace's `lint` runs it on itself.
- **D8 — Historical specs keep their paths** (`backend/…`, `frontend/…`); living docs (AGENTS, README,
  `plan/`, templates, spec 017) are updated.

## Project Structure

```text
package.json             workspaces, root scripts (dev:team, dev:portal, typecheck, test, lint, build)
scripts/check-design-rules.mjs
apps/
  api/                   was backend/ (FastAPI, unchanged inside)
  team/                  was frontend/ (@agile/team)
  portal/                @agile/portal: /p/:slug, phone first, no session
packages/
  ui/                    @agile/ui: tokens, theme.css, ds components, design-system/
  domain/                @agile/domain: transparency types
```

**Structure Decision**: each app keeps the hexagonal layout of its own `src/` (domain, application,
adapters, ui). Shared packages sit below the apps: `apps → packages`, never the other way.

## Phase 1: Setup

- [x] T001 Root `package.json` with workspaces and scripts; one lockfile at the root
- [x] T002 `git mv backend apps/api`, `git mv frontend apps/team`

## Phase 2: Foundational

- [x] T003 `packages/ui`: move `ds/`, `tokens.css`, the theme part of `index.css`, `design-system/`; keep
  `Toaster` in the team app; vitest config for the design system tests
- [x] T004 Rewrite the team app's imports to `@agile/ui`; its `index.css` keeps Tailwind and the home mesh
- [x] T005 `packages/domain` with the transparency types
- [x] T006 Design rules check at the root, run by each workspace's `lint`

## Phase 3: US1 / US2 — The portal app

- [x] T007 `apps/portal`: Vite config (`:5174`, `/api` proxy), `PublicPortalGateway` port and http adapter,
  `/p/:slug` page with the not-found state, a test

## Phase 4: Polish

- [x] T008 AGENTS.md, README, `plan/`, spec template paths, `.claude/skills/README.md`, spec 017 plan and briefs
- [x] T009 Backend `pytest`; root `typecheck`, `test`, `lint`, `build`
