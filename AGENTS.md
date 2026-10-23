# Instructions for AI agents

This repo uses **Spec-Driven Development (SDD)**. It applies to any assistant (Claude Code, Gemini CLI, Copilot, Cursor).

## Required workflow

1. **Spec** → `specs/NNN-feature/spec.md`: what and why (users, stories, acceptance criteria). Nothing technical.
2. **Plan** → `specs/NNN-feature/plan.md`: how (technical context, files to touch, decisions) and the **tasks**, grouped in phases: setup, foundational, one phase per user story, polish.
3. **Implement** one task at a time and mark it `[x]` in `plan.md`.

Rules:
- Don't write code for a feature without an approved `spec.md` and `plan.md` (`Status: Approved`).
- If the implementation contradicts the spec, update the spec first.
- Follow [specs/constitution.md](specs/constitution.md).
- Templates: [specs/spec-template.md](specs/spec-template.md) and [specs/plan-template.md](specs/plan-template.md).
- For frontend work, follow the skills in [.claude/skills/](.claude/skills/README.md) (visual design, React composition and performance, UI audit).

## Stack

- **Backend**: Python 3.13, FastAPI, SQLModel (SQLite), Google ADK + Gemini (`gemini-3.5-flash`)
- **Frontend**: React 19 + TypeScript + Vite, Tailwind, dnd-kit, React Router

## Structure (hexagonal architecture)

Product context in [plan/context.md](plan/context.md); architecture and decisions in [plan/hexagonal-architecture.md](plan/hexagonal-architecture.md); use cases in [plan/use-cases.md](plan/use-cases.md).

Dependency rule: `adapters → application → domain`, never the other way around (checked by `tests/architecture/test_layers.py`).

```
backend/app/
  main.py              composition root: picks adapters (mock or real) and mounts routers
  config.py            env vars (no API key → MOCK_AGENTS, no GITHUB_TOKEN → MOCK_GITHUB)
  domain/              entities, plan schemas (PLANNING_STAGES), proposals, events. No I/O
  application/
    ports/             interfaces (Protocol): repos, UnitOfWork, PlanningAgents, CodeHost, EventBus
    use_cases/         one module per use case, grouped by feature
    dto.py             use case inputs/outputs
  adapters/
    inbound/http/      FastAPI routers + SSE
    inbound/webhooks/  GitHub webhooks
    outbound/persistence/  SQLModel: tables, mappers, repos, UnitOfWork
    outbound/agents/   adk/ (Gemini) and mock/
    outbound/code_host/    github/ and fake
    outbound/events/   in-memory event bus
backend/tests/         unit/ (domain, application), integration/adapters/, architecture/
frontend/src/
  app/                 App, routes, composition root (container)
  domain/              types mirroring backend/app/domain + pure rules
  application/         ports.ts (gateways) + use-cases/ (hooks)
  adapters/            http/ (real backend) and fake/ (no backend)
  ui/                  pages/, components/, styles/, assets/
plan/                  product context, architecture and use cases
specs/                 SDD: constitution, templates, features
```

## Commands

```bash
# backend
cd backend && .venv/Scripts/activate && fastapi dev app/main.py   # :8000 (Linux/macOS: .venv/bin/activate)
cd backend && pip install -r requirements-dev.txt && pytest       # tests
# frontend
cd frontend && npm run dev                                         # :5173, /api → :8000
```

## Conventions

- **Everything in English**: code, identifiers, comments, docs, specs, plans and commit messages. Two exceptions: the UI text is in Spanish (spec 009, FR-012), and what the agents generate for a project follows the language of the project description (spec 002, FR-014).
- Agent outputs always use `output_schema` (Pydantic), never free text.
- HTTP endpoints follow [plan/api-conventions.md](plan/api-conventions.md) (headers, error body, status codes); each plan's **API Contract** section defines its endpoints, and new endpoints are added there before they're coded. [frontend/docs/api-contract.md](frontend/docs/api-contract.md) gathers them for the frontend (TypeScript shapes, gateways, error handling); update it in the same PR as the plan.
- Frontend types in `src/domain` stay aligned with `backend/app/domain/`.
- Nothing external (FastAPI, SQLModel, ADK, GitHub) is imported in `domain/` or `application/`: add a port and an adapter.
- SQLModel tables belong to the persistence adapter; the rest of the code uses the `domain/` entities.
