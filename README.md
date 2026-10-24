# TransparencIA

🥉 **3rd place winners at the 1st GDG DevFest Santa Marta Hackathon.**

> SECOP tells you how much was signed; we show you what was done with that money.

TransparencIA lets whoever executes a public project (a foundation, a company, an alcaldía's office, an individual contractor) plan it and run it with AI agents, and lets anyone follow it from a QR code: the work done, the money spent and the evidence behind each peso, week by week. Citizens, the contracting entity and citizen oversight groups (Ley 850 de 2003, Ley 1712 de 2014) open the portal on their phone, with no account.

**Demo case**: Fundación Manglares Vivos restores 5 ha of mangrove in the Ciénaga Grande de Santa Marta for Corpamag, COP 180,000,000 over 6 months. The foundation plans it and works it in the team app; Corpamag and any citizen follow it on the public portal.

## What we built

Two apps over one backend:

**Team app** (the executing entity, signed in, `:5173`)

- **Profile of who executes the contract** (spec 020): natural or legal person, with document, NIT and its check digit, legal representative, location and the personal data authorization (Ley 1581 de 2012).
- **Project and team**: create the project, invite the team with a link, roles leader and member (specs 001, 015).
- **Start from the contract** (spec 017, US7): upload the signed contract PDF and get an editable draft of the project, its parties, value, dates, budget lines, obligations and milestones. Works on the fake backend; the backend endpoint is still pending.
- **Work plan by stages** (specs 002, 019): six Gemini agents plan the project stage by stage (diagnosis, way of working, components and resources, schedule, activities, stages). Every stage arrives as a proposal the leader approves, adjusts or rejects (spec 005), and they plan field work, restoration or community work, not only software.
- **Activities board** (specs 003, 013, 014): the plan becomes stages and activities on a board (Por programar, Por hacer, En ejecución, En verificación, Terminada), with filters, quick add, steps per activity and stage goals that close by themselves. All in the words of public projects (spec 019), not sprints and backlogs.
- **Transparencia tab** (spec 017):
  - the contract's budget and its budget lines (rubros);
  - **evidence**: upload an invoice, field photo or report; Gemini reads it and drafts the amount, date, supplier, concept, budget line, the activity it proves, a one sentence summary for citizens and any inconsistency. A person confirms it before anything is public;
  - **rule alerts** on confirming: amount above what's left in the line, date outside the contract;
  - public answers to alerts, which can't be hidden or deleted;
  - publish the portal and get its link and QR code.

**Public portal** (anyone, no account, phone first, `:5174`)

- **Search** the published projects by name, contracting entity, contractor or topic, each with its traffic light, money used, work done and open alerts.
- **Project portal** at `/p/:slug`: the parties; a **traffic light** that compares physical progress, money spent and time elapsed, with its reasons in plain words; the **weekly timeline** with the activities finished and the evidence dated in each week; each phase with its activities done, under way or pending; the budget lines with spent and available; the evidence with photos; the alerts with their answers.
- **Citizen chat**: ask "¿en qué se gastaron la plata?" and get at most 3 sentences in plain Spanish, from the portal's data only, in Colombian pesos.

### Credibility rules

- Percentages and the traffic light are **computed by rules**, never by the AI. Every number in the portal can be recomputed by hand from the board and the confirmed expenses.
- The AI **only reads documents and explains**. It never accuses: it flags inconsistencies for a person to review.
- Nothing the AI reads is published until a person confirms it. The executing entity can answer alerts publicly, never hide them.

### Where Gemini works

All agents run on **Google ADK + Gemini** (`gemini-3.5-flash`) and always answer with a Pydantic `output_schema`, never free text.

| Agent | What it does |
|---|---|
| Planning pipeline (6 agents) | Diagnosis, way of working, components and resources, schedule by phases, activities with weight and compliance criteria, stages with assignment by role and load |
| Evidence reader | Reads an invoice, photo or report (PDF or image) and drafts the expense with its alerts |
| Citizen chat | Answers questions on the portal from the portal's data only |
| Replanning | Proposes adjusting the work plan when reality drifts from it (spec 008) |

Without an API key the backend runs in **mock mode**: the agents answer with fixed, realistic data, so the whole demo works offline.

## Architecture

- **Backend** (`apps/api`): Python 3.13, FastAPI, SQLModel (SQLite), Google ADK + Gemini. Hexagonal: `adapters → application → domain`, checked by `tests/architecture/test_layers.py`.
- **Frontends** (`apps/team`, `apps/portal`): React 19, TypeScript, Vite, Tailwind, dnd-kit, React Router. Same hexagonal layout; each one also runs on an in-memory fake backend.
- **Shared packages**: `@agile/ui` (design system) and `@agile/domain` (types both apps share). npm workspaces monorepo (spec 018).

More detail:

- [plan/hexagonal-architecture.md](plan/hexagonal-architecture.md): ports and adapters, folders and decisions.
- [plan/use-cases.md](plan/use-cases.md): use cases with diagrams.
- [plan/api-conventions.md](plan/api-conventions.md) and [apps/team/docs/api-contract.md](apps/team/docs/api-contract.md): the HTTP API.
- [specs/017-transparency-portal/spec.md](specs/017-transparency-portal/spec.md): the transparency module, its stories and rules.

## Run it

Backend:

```bash
cd apps/api
py -m venv .venv && .venv/Scripts/activate   # Linux/macOS: python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # set GOOGLE_API_KEY, or leave it empty for mock mode
python -m app.seed     # demo accounts and the mangrove project, planned, with budget, evidence and portal published
fastapi dev app/main.py
pytest
```

Frontends, from the root:

```bash
npm install
npm run dev:team       # team app :5173, /api → :8000
npm run dev:portal     # public portal :5174, /api → :8000
npm run typecheck && npm test && npm run lint
```

Demo accounts: `ana@manglaresvivos.org` (the foundation, leader) and `leo@manglaresvivos.org` (field technician, member), password `agile-demo`. The seeded portal is at http://localhost:5174/p/manglar-cienaga.

`create_db()` doesn't migrate: after pulling schema changes, delete `apps/api/agile.db` and seed again.

## How we work: SDD

Spec → Plan (with tasks) → Code. Each feature lives in `specs/NNN-feature/` with `spec.md` and `plan.md`; principles in [specs/constitution.md](specs/constitution.md), owners and reviewers in [specs/README.md](specs/README.md). The rules for AI assistants are in [AGENTS.md](AGENTS.md), which [CLAUDE.md](CLAUDE.md) and [GEMINI.md](GEMINI.md) load.

The product started as an AI agile planner for software teams (specs 001 to 016). For the hackathon we turned it into TransparencIA (specs 017 to 020). The GitHub integration and the generated software specs and diagrams (specs 006 to 008) are still in the code, but hidden from the app and turned off (`GENERATE_DOCUMENTS` flag).

## Team

sandredev, Mitchz01 and codigotpx.

## Pending

- [ ] Backend endpoint to read the contract PDF (`POST /api/contracts/read`, spec 017 US7)
- [ ] Public deployment, so the QR works from any phone
