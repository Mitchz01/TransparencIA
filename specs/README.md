# Specs: who does what

Each person **owns an area end to end** (spec → plan → code) and **reviews** someone else's specs. A spec moves to `Approved` when its reviewer approves it. Use cases are in [plan/use-cases.md](../plan/use-cases.md); templates in [spec-template.md](spec-template.md) and [plan-template.md](plan-template.md).

| Spec | Feature | Use cases | Owner | Reviewer | Round |
|---|---|---|---|---|---|
| [001](001-project-team-setup/spec.md) | Project and team setup | UC-01, UC-02 | sandredev | codigotpx | 1 |
| [002](002-agent-planning-pipeline/spec.md) | Agent planning pipeline | UC-03 | Mitchz01 | sandredev | 1 |
| [003](003-kanban-board/spec.md) | Kanban board and sprints | UC-05, UC-06 | codigotpx | Mitchz01 | 1 |
| [005](005-proposals-approval/spec.md) | Proposals, approval and live activity | UC-04, UC-14 | sandredev | codigotpx | 1 |
| [004](004-roadmap-architecture-views/spec.md) | Roadmap, methodology and architecture views | UC-07 | sandredev | codigotpx | 2 |
| [006](006-generated-specs-diagrams/spec.md) | Generated specs and diagrams | UC-08 | Mitchz01 | sandredev | 2 |
| [007](007-github-integration/spec.md) | GitHub integration | UC-09, UC-10, UC-11 | codigotpx | Mitchz01 | 3 |
| [008](008-github-sync-replanning/spec.md) | GitHub sync and replanning | UC-12, UC-13 | Mitchz01 | sandredev | 3 |
| [009](009-frontend/spec.md) | Frontend: every screen | UI of UC-01 to UC-14 | Mitchz01 | codigotpx | 1–3, story by story |
| [011](011-task-panel/spec.md) | Compact task panel | UI of UC-08 to UC-10 | Mitchz01 | codigotpx | 4 |
| [012](012-visual-plan-views/spec.md) | Visual plan views | UI of UC-07 | Mitchz01 | codigotpx | 4 |
| [013](013-board-density/spec.md) | A board you read at a glance | UI of UC-05, UC-06 | Mitchz01 | codigotpx | 4 |
| [014](014-board-views-quick-add/spec.md) | Board views, filters and quick add | UC-05, UC-06 | Mitchz01 | codigotpx | 4 |
| [015](015-accounts-invitations/spec.md) | Accounts, invitations and project roles | UC-15, UC-16, UC-17 | Mitchz01 | codigotpx | 4 |
| [016](016-home-launchpad/spec.md) | Home launchpad | UI of UC-01 | Mitchz01 | codigotpx | 4 |

## Areas

- **sandredev: Set up and decide.** The leader sets up the project, approves or rejects what the agents propose and follows the live activity. Also the read-only plan views.
- **Mitchz01: Agents.** Everything that runs on Gemini/ADK: the plan stages, generated specs and diagrams, replanning.
- **codigotpx: Work and integrate.** The board where work moves and the GitHub connection (issues, code review).
- **Frontend (spec 009).** Specs 001 to 008 own the behavior and the API; spec 009 owns every screen, built on [apps/team/docs/api-contract.md](../apps/team/docs/api-contract.md) and the [design system](../frontend/design-system/README.md). Its stories follow the same rounds: P1 stories with round 1, and so on.

## Order

- **Round 1** = the demo (constitution, principle 1): project → plan → approval → board. Written first and in parallel.
- **Round 2** = completes the demo. **Round 3** = extras if there's time left.

## Contracts between specs

Where one spec depends on another, both owners agree on this **before** approving:

| Between | What to agree on | Owners |
|---|---|---|
| 001 → 002 | Which project and team data the agents receive | sandredev, Mitchz01 |
| 002 → 005 | Shape of a per-stage proposal and what happens when it's rejected | Mitchz01, sandredev |
| 005 → 003 | What gets created on the board when the plan is approved (`PlanApplied`) | sandredev, codigotpx |
| 007 → 008 | Which GitHub events arrive by webhook and how they move tasks | codigotpx, Mitchz01 |
| 003, 005 | Events shown in the live activity feed | codigotpx, sandredev |
| 001–008 → 009 | Any endpoint or field a screen needs goes into the owner's plan and `api-contract.md` first | each owner, Mitchz01 |
