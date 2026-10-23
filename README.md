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

### GitHub integration (spec 007)

Without any token the backend runs in **test mode**: `FakeCodeHost` records what would be written to GitHub and nothing leaves the machine. To use a real repo:

1. Create a fine-grained token with access to the repo: *Issues*, *Pull requests* and *Contents* read/write, plus *Webhooks* read/write (admin) so the repo's events reach us. Set it as `GITHUB_TOKEN` in `.env` (installation token), or paste it in Integrations when connecting a project (project token, never shown again).
2. Let GitHub reach the backend. Webhooks are registered at `{PUBLIC_BASE_URL}/webhooks/github`, or at `GITHUB_WEBHOOK_URL` when it's set.
   - With [smee.io](https://smee.io) (local dev): create a channel on the site, set `GITHUB_WEBHOOK_URL=https://smee.io/<channel>` (smee only forwards the channel URL itself) and run
     ```bash
     npx smee-client --url https://smee.io/<channel> --target http://localhost:8000/webhooks/github
     ```
   - With a tunnel that keeps paths (`cloudflared tunnel --url http://localhost:8000`, `ngrok http 8000`) or a deployment: set `PUBLIC_BASE_URL` to its public URL.
3. Set `GITHUB_WEBHOOK_SECRET` to any random string: it signs the webhook deliveries (checked by spec 008).
4. Optional: set `SECRET_KEY` to encrypt project tokens in the database. Without it they're stored **in plain text** in SQLite, which is fine for a local demo only.

With both `PUBLIC_BASE_URL` and `GITHUB_WEBHOOK_URL` empty, repos connect without a webhook (`webhook_registered: false`): issues and reviews still work, but nothing comes back from GitHub.

## Run the frontend

```bash
cd frontend
npm install
npm run dev                      # :5173, proxy /api → :8000
VITE_USE_FAKE=true npm run dev   # whole demo without a backend (fake agents)
```

Scripts, the fake backend and the checks: [frontend/README.md](frontend/README.md).

## TODO

> The `member.active`, `proposal` and `activity` columns/tables are new and `create_db()` doesn't migrate: delete any local `backend/agile.db` before running. Spec 007 adds `project.github_token`, `project.webhook_id`, `member.github_username`, `proposal.result` and the `external_link` and `own_write` tables.


- [x] Projects and team API (spec 001): `POST/GET/PATCH /api/projects`
- [x] Proposals, approval and live activity (spec 005): `/api/proposals/...`, `/activity`, SSE `/events` with replay
- [x] Plan views (spec 004): `GET /api/projects/{id}/plan`
- [ ] Per-stage planning pipeline (spec 002) and its `plan_stage` applier, `PATCH /tasks/{id}` (spec 003)
- [ ] Persist the approved plan as Sprint and Task
- [x] GitHub integration backend (spec 007): `PUT/DELETE /api/projects/{id}/repository`, `POST /api/projects/{id}/issues/propose`, `PUT /api/members/{id}/github-username`, `github_action` appliers
- [ ] Generated specs and diagrams (006), sync and replanning (008)
- [x] Frontend (spec 009): every screen, on the API contract or on the fake backend
- [x] Extra: replan ("a dev left, adjust the sprint"), on the frontend and its fake backend
- [ ] Deploy to Cloud Run
