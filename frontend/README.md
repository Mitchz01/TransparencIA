# Agile Planner, frontend

React SPA for every screen of the product (spec 009). It talks to the backend only through the API contract ([docs/api-contract.md](docs/api-contract.md)) and is built only with the design system ([design-system/README.md](design-system/README.md)). The interface is in Spanish; code and docs are in English.

## Run it

```bash
npm install
npm run dev                      # :5173, /api goes to the backend on :8000
VITE_USE_FAKE=true npm run dev   # no backend: in-memory service with fake agents
```

With `VITE_USE_FAKE=true` the whole demo works without the API: two seeded projects (one waiting for the backlog approval, one with its plan complete, board in use and documents), agents that "work" for a moment and propose each stage, the board built when the sprints are approved, documents, test-mode GitHub and replanning. The state survives a reload. From the browser console:

| Command | What it does |
|---|---|
| `fakeBackend.reset()` | Back to the seeded demo |
| `fakeBackend.setOffline(true)` | Every call fails like an unreachable server (try a card move) |
| `fakeBackend.planning.failNextStage(id)` | The next stage of that project fails, to show the retry |

In the integrations screen, a repo name with `privado` or `no-existe` answers like GitHub would without access.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type check and production build |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | Lint plus `scripts/check-design-rules.mjs`, which fails on what breaks the design rules (em dashes, dot separators, emojis, one-sided borders, dividers, uppercase labels, monospace, round dots) |
| `npm test` | Unit and flow tests (jsdom) on the fake backend |

## Structure

Hexagonal, like the backend: `ui → application → domain`, and only `app/container.tsx` imports `adapters/`.

| Folder | What lives there |
|---|---|
| `src/domain` | Shapes that mirror the backend, and pure rules: form validation, capacity, WIP, moves, the planning stepper |
| `src/application` | Ports (gateways), hooks per use case, live updates from the event stream, error handling per error code |
| `src/adapters/http` | The real API client and gateways |
| `src/adapters/fake` | The in-memory service: store, fake agents, demo data |
| `src/ui` | Design system components (`components/ds`), feature components and pages |
| `src/app` | Composition root: providers, routes, theme |

Screens load with their route; only the documents screen brings the markdown renderer, and diagrams load their renderer when one is opened.
