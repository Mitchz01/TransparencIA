# Agile Planner

Like Jira, but the plan is built by agents: you enter the project and your team (roles, seniority, hours), and a pipeline of **Google ADK + Gemini** agents generates the methodology (or uses the one you pick), the architecture, a phased roadmap, the backlog and the sprints, all loaded into a kanban board.

## Agent pipeline

Stages in order; each one is an `LlmAgent` that returns JSON with a schema ([domain/plan.py](backend/app/domain/plan.py)):

1. **Product analyst**: goals, scope, risks, team gaps
2. **Agile coach**: Scrum / Kanban / Scrumban / XP / Shape Up, with ceremonies and WIP limits
3. **Software architect**: style, components, stack, ADRs
4. **Product manager**: phases and epics
5. **Product owner**: stories with points and acceptance criteria
6. **Scrum master**: sprints and assignment by role and capacity

## Context and architecture

- [plan/context.md](plan/context.md): what the product is and how it's used (no technical details).
- [plan/hexagonal-architecture.md](plan/hexagonal-architecture.md): hexagonal architecture (ports and adapters), folders and decisions.
- [plan/use-cases.md](plan/use-cases.md): use cases with diagrams of how each one is implemented.
- [plan/api-conventions.md](plan/api-conventions.md): HTTP API rules (headers, error body, status codes); each spec's plan has its API Contract.
- [frontend/docs/api-contract.md](frontend/docs/api-contract.md): the whole API from the frontend's side: TypeScript shapes, endpoints by gateway, errors and SSE events.

## How we work: SDD

Spec → Plan (with tasks) → Code. Each feature lives in `specs/NNN-feature/` with `spec.md` and `plan.md` (templates: [spec-template.md](specs/spec-template.md) and [plan-template.md](specs/plan-template.md); principles in [specs/constitution.md](specs/constitution.md)). The rules for AI assistants, the structure and the commands are in [AGENTS.md](AGENTS.md), which [CLAUDE.md](CLAUDE.md) and [GEMINI.md](GEMINI.md) also load.

The 8 specs (001–008), who writes and reviews each one, the order and the contracts between specs are in [specs/README.md](specs/README.md).

## Run the backend

```bash
cd backend
py -m venv .venv && .venv/Scripts/activate   # Linux/macOS: python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # set GOOGLE_API_KEY
fastapi dev app/main.py
pytest                 # tests (includes the architecture layer test)
```

## Run the frontend

```bash
cd frontend
npm install
npm i -D tailwindcss @tailwindcss/vite   # pending: failed because the disk was full
npm run dev                               # :5173, proxy /api → :8000
```

## TODO

> The `member.active`, `proposal` and `activity` columns/tables are new and `create_db()` doesn't migrate: delete any local `backend/agile.db` before running.


- [x] Projects and team API (spec 001): `POST/GET/PATCH /api/projects`
- [x] Proposals, approval and live activity (spec 005): `/api/proposals/...`, `/activity`, SSE `/events` with replay
- [x] Plan views (spec 004): `GET /api/projects/{id}/plan`
- [ ] Per-stage planning pipeline (spec 002) and its `plan_stage` applier, `PATCH /tasks/{id}` (spec 003)
- [ ] Persist the approved plan as Sprint and Task
- [ ] Generated specs and diagrams (006), GitHub (007), sync and replanning (008)
- [ ] Frontend: project setup, agent progress, kanban, roadmap
- [ ] Extra: replan ("a dev left, adjust the sprint")
- [ ] Deploy to Cloud Run
