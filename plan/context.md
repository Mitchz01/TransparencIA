# Product context

What Agile Planner is, who it's for and how it's used. No technical details: those are in [hexagonal-architecture.md](hexagonal-architecture.md) and [use-cases.md](use-cases.md).

## What it is

A Jira-like system that organizes software development teams, orchestrated by AI agents. The leader enters their team and what they want to build, and the agents put together the whole work plan, keep it up to date as development moves forward and connect to the tools the team uses, like GitHub.

## Who it's for

- **Team leader** (or whoever uses the tool): defines the team and the goal, and approves or adjusts what the agents propose.
- **Team members**: work on the board and on GitHub; the system updates itself with their progress.

## What it does

1. **Define the team and the goal**: who they are, what role each one plays (with seniority and available hours) and what product or goal they're after.
2. **Choose the methodology**: the agents recommend the best fit (Scrum, Kanban, Scrumban, XP, Shape Up) and explain why. If the user already picked one, they respect it and adapt it to the team.
3. **Lay out the work**: sprints, tasks or cards with priority, assignment based on each member's role, and a checklist on each task.
4. **Document**: a visual roadmap by phases, flow diagrams, a general product spec and one spec per epic.
5. **Connect with GitHub**: open issues and code review requests, and close tasks and objectives as the code moves forward.
6. **Stay alive**: the plan updates with real development. If there are delays or new work shows up, the agents propose replanning.

## Core principle: everything goes through the user

Every agent decision arrives as a **proposal** with its rationale: what they decided and why. The user **approves**, **adjusts** or **rejects** it, and nothing is applied to the board or to GitHub before that.

**Auto-approve**: each project can turn it on to move fast (for example, in a demo). Proposals are still recorded with their rationale, and the user can review them and ask for changes later.

## How it's used (typical journey)

1. The leader creates the project: describes the product, enters the team and, optionally, picks the methodology.
2. The agents work in stages: analysis → methodology → architecture → roadmap → backlog → sprints → specs and diagrams. The user sees live which agent is working.
3. When each stage finishes, the user approves or adjusts the proposal (or it's approved automatically if auto-approve is on).
4. With the plan approved, the board appears with sprints and tasks, along with the roadmap and the documents.
5. The leader connects the GitHub repo; the approved tasks become issues.
6. As the team opens and merges PRs, tasks move forward on the board by themselves, checklists get checked and objectives get closed.

## Decisions made

| Topic | Decision |
|---|---|
| Approval | Manual by default, with an auto-approve option per project. |
| GitHub | Each project connects to **a single repo**. |
| Source of truth | **Our board.** GitHub mirrors the tasks; only progress comes in from GitHub (PR opened, PR merged, issue closed). No sync with GitHub Projects. |

## Concepts

| Term | Meaning |
|---|---|
| Proposal | Something an agent decided that is waiting for the user's approval. |
| Objective | Concrete goal of a sprint; it closes when its tasks are done. |
| Checklist | Concrete steps inside a task, checked off as they're done. |
| Spec | Document that describes what the product does (general) or a specific epic. |
| Replanning | The agents' proposal to adjust the plan when reality drifts from it. |
