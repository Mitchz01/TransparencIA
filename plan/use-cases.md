# Use cases

Use cases derived from [context.md](context.md) and how each one would be implemented on the [hexagonal architecture](hexagonal-architecture.md). Diagrams are Mermaid (they render on GitHub and in VS Code).

- **Status**: Draft
- The first section (catalog and map) can be read without knowing the code. From "Implementation per use case" on it's technical.

## Actors

| Actor | Who they are |
|---|---|
| **Leader** | Whoever uses the tool: sets up the team, defines the goal and approves what the agents propose. |
| **Member** | Works on the board and on GitHub. |
| **AI agents** | Product analyst, agile coach, architect, product manager, product owner, scrum master, spec writer, code reviewer. |
| **GitHub** | External system: issues, PRs, reviews. Reports changes by webhook. |

## Catalog

| ID | Use case | Primary actor | Spec |
|---|---|---|---|
| UC-01 | Create project and team | Leader | 001 |
| UC-02 | Edit project and team | Leader | 001 |
| UC-03 | Generate the plan by stages | AI agents | 002 |
| UC-04 | Review a proposal (approve, adjust, reject or auto-approve) | Leader | 005 |
| UC-05 | Apply the approved plan to the board | System | 003 |
| UC-06 | Work on the board (move, edit, checklist) | Leader / Member | 003 |
| UC-07 | View roadmap, methodology and architecture | Leader / Member | 004 |
| UC-08 | Generate specs and diagrams | AI agents | 006 |
| UC-09 | Connect the GitHub repo | Leader | 007 |
| UC-10 | Publish tasks as issues | AI agents → Leader | 007 |
| UC-11 | Request a code review for a PR | AI agents → Leader | 007 |
| UC-12 | Sync progress from GitHub and close objectives | GitHub | 008 |
| UC-13 | Replan | Leader / AI agents | 008 |
| UC-14 | Follow the live activity | Leader / Member | 005 |

## Overview map

Each actor takes part in one area; how the use cases chain together is in the full journey below.

```mermaid
flowchart LR
    leader([Leader])
    member([Member])
    ai([AI agents])
    gh([GitHub])

    subgraph setup [Set up]
        direction TB
        uc01[UC-01 Create project and team]
        uc02[UC-02 Edit project and team]
        uc09[UC-09 Connect repo]
    end

    subgraph plan [Plan]
        direction TB
        uc03[UC-03 Generate the plan by stages]
        uc08[UC-08 Generate specs and diagrams]
        uc13[UC-13 Replan]
    end

    subgraph decide [Decide]
        direction TB
        uc04[UC-04 Review proposal]
    end

    subgraph work [Work]
        direction TB
        uc05[UC-05 Apply plan to the board]
        uc06[UC-06 Work on the board]
        uc07[UC-07 View roadmap and decisions]
        uc14[UC-14 Live activity]
    end

    subgraph integrate [Integrate with GitHub]
        direction TB
        uc10[UC-10 Publish issues]
        uc11[UC-11 Request code review]
        uc12[UC-12 Sync progress]
    end

    leader --> setup
    leader --> decide
    leader --> work
    member --> work
    ai --> plan
    ai --> integrate
    gh <--> integrate
    plan -- proposals --> decide
    integrate -- proposals --> decide
```

## Full journey

```mermaid
flowchart TD
    a[Leader creates project and team] --> a2[Leader starts planning]
    a2 --> b[Agent runs the stage]
    b --> c{Auto-approve?}
    c -- No --> d[Pending proposal]
    d --> e{Leader decides}
    e -- Approves or adjusts --> f[It's applied]
    e -- Rejects --> g[The agent redoes the stage with the reason]
    g --> b
    c -- Yes --> f
    f --> h{Stages left?}
    h -- Yes --> b
    h -- No --> i[Board, roadmap, specs and diagrams ready]
    i --> j[Leader connects GitHub]
    j --> k[Tasks published as issues]
    k --> l[Team opens and merges PRs]
    l --> m[Tasks and objectives move forward by themselves]
    m --> n{Drift?}
    n -- Yes --> o[Replan proposal]
    o --> e
    n -- No --> l
```

## States

### Proposal

```mermaid
stateDiagram-v2
    [*] --> pending: the agent proposes
    pending --> approved: approve (or auto-approve)
    pending --> adjusted: adjust with changes
    pending --> rejected: reject with a reason
    pending --> discarded: replaced by a newer one (system)
    rejected --> adjusted: only the newest one, after 3 rejections in a row
    approved --> [*]: it's applied
    adjusted --> [*]: the adjusted version is applied
    rejected --> [*]: the agent redoes it
    discarded --> [*]
```

Applying is separate from the status: an approved or adjusted proposal whose application fails keeps its status, gets `apply_failed = true`, and can be retried (`POST /api/proposals/{id}/apply`, spec 005).

### Task

```mermaid
stateDiagram-v2
    [*] --> todo: plan applied (task in a sprint)
    [*] --> backlog: plan applied (task outside every sprint)
    backlog --> todo: enters a sprint
    todo --> in_progress: moved, or a PR is opened
    in_progress --> review: PR ready for review
    review --> in_progress: changes requested
    review --> done: PR merged or moved by hand
    done --> todo: issue reopened
    done --> [*]
```

---

## Implementation per use case

Diagram conventions:

- **UI**: frontend (React), goes through the frontend's `adapters/http`.
- **HTTP** / **Webhook**: inbound adapters (`adapters/inbound`).
- The participant in the middle is the **use case** (`application/use_cases`).
- **UoW**, **Agents**, **CodeHost**, **EventBus**: ports. At runtime they're implemented by SQLModel, ADK or mock, GitHub or fake, and the in-memory bus.

Agent calls take time (seconds to minutes), so they **never run inside the HTTP request**: the endpoint answers `202 Accepted`, the use case runs in a background task and progress arrives through SSE (UC-14).

### UC-01 · Create project and team

- **Trigger**: the leader fills in the form (name, description, duration, optional methodology, auto-approve, members with role, seniority, hours and skills).
- **Result**: project in `draft` with its team. Planning starts with a separate request (spec 002), which the UI sends right after.
- **Use case**: `projects/create_project.py`

```mermaid
sequenceDiagram
    actor L as Leader
    participant UI
    participant HTTP as HTTP projects
    participant UC as CreateProject
    participant UoW
    participant SP as StartPlanning

    L->>UI: fills in project and team
    UI->>HTTP: POST /api/projects (ProjectCreate)
    HTTP->>UC: execute(ProjectCreate)
    UC->>UC: validates (at least one member, unique names, duration 1-52)
    UC->>UoW: projects.add(Project with members)
    UC->>UoW: commit()
    UC-->>HTTP: Project with ids
    HTTP-->>UI: 201 Project
    UI->>HTTP: POST /api/projects/{id}/planning
    HTTP->>SP: launches UC-03 in the background
    HTTP-->>UI: 202 Accepted
    UI->>UI: navigates to Planning and opens the SSE stream (UC-14)
```

### UC-02 · Edit project and team

- **Trigger**: the leader changes project data, adds or removes members, or toggles auto-approve.
- **Result**: project updated. If the team changed, a `TeamChanged` event is published; with a plan already applied, spec 008 proposes a replan (UC-13).
- **Use case**: `projects/update_project.py`

```mermaid
sequenceDiagram
    actor L as Leader
    participant UI
    participant HTTP as HTTP projects
    participant UC as UpdateProject
    participant UoW
    participant Bus as EventBus

    L->>UI: edits the team
    UI->>HTTP: PATCH /api/projects/{id}
    HTTP->>UC: execute(id, changes)
    UC->>UoW: projects.get(id)
    alt doesn't exist
        UC-->>HTTP: ProjectNotFound
        HTTP-->>UI: 404
    else exists
        UC->>UoW: projects.save(project)
        UC->>UoW: commit()
        UC->>Bus: publish(TeamChanged) if the team changed
        UC-->>HTTP: Project
        HTTP-->>UI: 200
    end
```

### UC-03 · Generate the plan by stages

- **Trigger**: the "start planning" request, or the approval of the previous stage (UC-04).
- **Result**: one `pending` proposal per stage (or `approved` with auto-approve).
- **Stages** (`PLANNING_STAGES`): analysis → methodology → architecture → roadmap → backlog → sprints. The document stages follow (UC-08).
- **Use cases**: `planning/start_planning.py`, `planning/run_planning_step.py`. They replace the current `RunPlanning`, which runs everything back to back.

```mermaid
sequenceDiagram
    participant SP as StartPlanning
    participant RS as RunPlanningStep
    participant UoW
    participant AG as Agents
    participant Bus as EventBus
    participant AP as ApproveProposal

    SP->>UoW: project.status = planning
    SP->>RS: run(project_id, first stage)
    RS->>UoW: project and already-resolved proposals
    RS->>RS: builds the context from stage.inputs (final_content of what was approved)
    RS->>Bus: publish(AgentStarted)
    RS->>AG: run_stage(stage, context)
    alt the agent fails
        AG-->>RS: error
        RS->>UoW: project.status = error
        RS->>Bus: publish(PlanFailed)
    else ok
        AG-->>RS: output with the stage's schema
        RS->>UoW: proposals.add(pending Proposal, kind plan_stage)
        RS->>UoW: commit()
        RS->>Bus: publish(AgentFinished and ProposalCreated)
        opt project.auto_approve
            RS->>AP: approve(proposal, auto=true)
        end
    end
```

### UC-04 · Review a proposal

- **Trigger**: the leader opens a pending proposal (sees what the agent decided and why) and chooses.
- **Result**:
  - **Approve or adjust**: the decision is saved right away; then the step its owner spec registered applies `final_content` (see table) and, for plan stages, the next stage starts.
  - **Reject**: the reason (required) is saved and handed to the owner; for plan stages, spec 002 redoes the stage with the reason as context. After 3 rejections in a row of the same stage, it waits for the leader, who can adjust the newest rejected proposal with their own version.
- **Use cases**: `proposals/resolve_proposal.py` (`ApproveProposal`, `AdjustProposal`, `RejectProposal`), `proposals/apply_proposal.py` (`ApplyProposal`, `ApplierRegistry`, `RetryApply`), `proposals/auto_approve.py`, `proposals/approve_many.py`

| Proposal kind | What applying it does | Registered step |
|---|---|---|
| `plan_stage` | Saves the stage in `project.plan` and launches the next one; after `sprints`, triggers UC-05. On rejection, redoes the stage | `AdvancePlanning.on_proposal_resolved` (002) |
| `document` | Creates or versions a `Document` (UC-08) | `ApplyDocumentProposal` (006) |
| `github_action` | Runs the action on `CodeHost` (UC-10, UC-11) | `PublishIssues` / `ApplyReview` (007) |
| `replan` | Applies the changes to the board (UC-13) | `ApplyReplan` (008) |

```mermaid
sequenceDiagram
    actor L as Leader
    participant UI
    participant HTTP as HTTP proposals
    participant UC as ApproveProposal
    participant UoW
    participant Bus as EventBus
    participant AP as ApplyProposal
    participant Step as Owner spec step

    L->>UI: approves or adjusts (with changes)
    UI->>HTTP: POST /api/proposals/{id}/approve or /adjust
    HTTP->>UC: execute(id, optional adjusted content)
    UC->>UoW: proposals.get(id)
    UC->>UC: proposal.approve() or adjust(validated content)
    alt already resolved (or decided at the same time by someone else)
        UC-->>HTTP: ProposalAlreadyResolved
        HTTP-->>UI: 409
    else pending
        UC->>UoW: proposals.save_if_status(proposal, "pending")
        UC->>UoW: commit()
        UC->>Bus: publish(ProposalResolved)
        HTTP-->>UI: 200 Proposal
        HTTP->>AP: spawn(execute(id)), own UnitOfWork
        AP->>Step: registered step for the kind (table)
        alt the step fails
            AP->>UoW: mark_apply_failed(error)
            AP->>Bus: publish(ProposalApplyFailed)
        end
    end
```

With **auto-approve**, the creator calls `AutoApprove.after_created(proposal_id)` after saving the proposal: it's approved with `auto_approved = true` and applied the same way, unless its `origin` is `automatic` (spec 008 drift replans always wait for the leader).

### UC-05 · Apply the approved plan to the board

- **Trigger**: the `sprints` stage is approved.
- **Result**: `Sprint`, `Objective` and `Task` created, with priority, points, acceptance criteria, checklist and assignee; the project moves to `ready`.
- **Assignment**: by the agent's exact `member_name`; otherwise, the member with the requested `role` and the fewest points in that sprint; if nobody has the role, unassigned and flagged with the missing role (spec 003, FR-006).
- **Checklist**: comes from each story's acceptance criteria.
- **Use case**: `planning/apply_plan.py` (pure building logic in `domain/board.py`)

```mermaid
sequenceDiagram
    participant AP as ApproveProposal
    participant UC as ApplyPlan
    participant UoW
    participant Bus as EventBus

    AP->>UC: execute(project_id)
    UC->>UoW: project with plan (approved backlog and sprints)
    loop each SprintPlan
        UC->>UoW: sprints.add(Sprint) and objectives.add(Objective)
        loop each story_key in the sprint
            UC->>UC: Story to Task (checklist from acceptance_criteria)
            UC->>UC: assigns by name, then by role
            UC->>UoW: tasks.add(Task status todo)
        end
    end
    UC->>UoW: stories outside every sprint → tasks.add(Task status backlog)
    UC->>UoW: project.status = ready
    UC->>UoW: commit()
    UC->>Bus: publish(PlanApplied)
```

### UC-06 · Work on the board

- **Trigger**: someone drags a card (dnd-kit), edits a task or checks a checklist item.
- **Result**: task updated. If the methodology's WIP limit is exceeded, a warning is shown but nothing is blocked ("The user is in charge").
- **Use cases**: `board/move_task.py`, `board/update_task.py`, `board/toggle_checklist_item.py`

```mermaid
sequenceDiagram
    actor M as Member
    participant UI
    participant HTTP as HTTP board
    participant UC as MoveTask
    participant UoW
    participant Bus as EventBus

    M->>UI: drags the card to another column
    UI->>UI: optimistic update
    UI->>HTTP: PATCH /api/tasks/{id} (status, position)
    HTTP->>UC: execute(id, TaskUpdate)
    UC->>UoW: tasks.get(id)
    UC->>UC: applies the change and reorders positions
    UC->>UC: checks the column's WIP limit
    UC->>UoW: tasks.save(task)
    UC->>UoW: commit()
    UC->>Bus: publish(TaskStatusChanged)
    UC-->>HTTP: Task (+ WIP warning if applicable)
    HTTP-->>UI: 200
    Note over UI: if it fails, the UI reverts the move
```

### UC-07 · View roadmap, methodology and architecture

- **Trigger**: the leader or a member opens the plan views.
- **Result**: visual roadmap by phases and weeks with each epic's and phase's progress, methodology with ceremonies and discarded alternatives, and architecture with its decisions. Each view says its status (not generated, waiting for approval, approved) and, when approved, the agent, its rationale and how it was approved.
- **Use case**: `projects/get_plan_views.py` (read-only). The views are built by the pure `domain/plan_views.build_plan_views`; the roadmap is drawn in the frontend from `RoadmapView.phases`.

```mermaid
sequenceDiagram
    actor L as Leader
    participant UI
    participant HTTP as HTTP projects
    participant UC as GetPlanViews
    participant UoW

    L->>UI: opens Roadmap
    UI->>HTTP: GET /api/projects/{id}/plan
    HTTP->>UC: execute(id)
    UC->>UoW: projects.get, proposals and tasks by project
    UC->>UC: build_plan_views(project, proposals, tasks, today)
    UC-->>HTTP: PlanViews
    HTTP-->>UI: 200
    UI->>UI: timeline with phases, epics and their tasks' progress
```

### UC-08 · Generate specs and diagrams

- **Trigger**: the plan finishes being approved (after `sprints`), or the leader asks to regenerate a document.
- **Result**: proposals of kind `document`: general spec, one spec per roadmap epic, and flow diagrams in Mermaid. Once approved they become versioned `Document`s.
- **New stages** in `PLANNING_STAGES`: `general_spec`, `epic_specs`, `flow_diagrams`, each with its output schema.
- **Use case**: `planning/generate_documents.py`, which reuses `RunPlanningStep`.

```mermaid
sequenceDiagram
    participant AP as ApproveProposal
    participant UC as GenerateDocuments
    participant AG as Agents
    participant UoW
    participant Bus as EventBus

    AP->>UC: full plan approved
    loop general_spec, epic_specs, flow_diagrams
        UC->>Bus: publish(AgentStarted)
        UC->>AG: run_stage(stage, approved plan)
        AG-->>UC: documents (Markdown or Mermaid)
        UC->>UoW: proposals.add(Proposal kind document)
        UC->>UoW: commit()
        UC->>Bus: publish(ProposalCreated)
    end
    Note over AP,Bus: on approval, ApproveProposal creates or versions the Document
```

### UC-09 · Connect the GitHub repo

- **Trigger**: the leader types `owner/name` in Integrations.
- **Result**: `project.repository` saved and webhook registered on the repo. One repo per project: if there was one already, it's replaced.
- **Use case**: `integrations/connect_repository.py`
- **Port**: `CodeHost` needs `check_access(repository)` and `register_webhook(repository, url, secret)`.

```mermaid
sequenceDiagram
    actor L as Leader
    participant UI
    participant HTTP as HTTP integrations
    participant UC as ConnectRepository
    participant CH as CodeHost
    participant UoW

    L->>UI: owner/name
    UI->>HTTP: PUT /api/projects/{id}/repository
    HTTP->>UC: execute(id, repository)
    UC->>CH: check_access(repository)
    alt no access or doesn't exist
        CH-->>UC: error
        UC-->>HTTP: RepositoryNotAccessible
        HTTP-->>UI: 422
    else ok
        UC->>CH: register_webhook(repository, url, secret)
        UC->>UoW: project.repository = owner/name
        UC->>UoW: commit()
        UC-->>HTTP: Project
        HTTP-->>UI: 200
    end
```

### UC-10 · Publish tasks as issues

- **Trigger**: the first time the project has both a board (UC-05) and a repo, when a replan that adds tasks is approved, or when the leader asks for it (spec 007, FR-006).
- **Result**: a `github_action` proposal with the list of issues to create. When approved, each issue is created (title, description, criteria and checklist as a GitHub task list, type and priority labels) and a task ↔ issue `ExternalLink` is saved.
- **Use cases**: `integrations/propose_issues.py` and the `github_action` branch of `ApproveProposal`.

```mermaid
sequenceDiagram
    participant UC as ProposeIssues
    participant UoW
    participant AP as ApproveProposal
    participant CH as CodeHost
    participant Bus as EventBus

    UC->>UoW: tasks without an issue ExternalLink
    UC->>UoW: proposals.add(github_action create_issues)
    UC->>Bus: publish(ProposalCreated)
    Note over UC,AP: the leader approves (or auto-approve)
    loop each task in the proposal
        AP->>CH: create_issue(repo, title, body, labels)
        CH-->>AP: IssueRef
        AP->>UoW: links.add(task-issue ExternalLink)
    end
    AP->>UoW: commit()
    AP->>Bus: publish(IssuesPublished)
    Note over AP,CH: if one fails, the ones already created stay linked and the proposal marks which are missing
```

### UC-11 · Request a code review for a PR

- **Trigger**: a webhook arrives for an opened PR that references a project issue (`Closes #12`).
- **Result**: a `github_action` proposal with the suggested reviewers (members with the right role and the lowest load) and a review comment written by the reviewer agent. When approved, the reviews are requested and the comment is posted.
- **Use case**: `integrations/propose_review.py`
- **Port**: `CodeHost` needs `get_pull_request_diff` and `comment_on_pull_request`. Members need their GitHub username (`Member.github_username`).

```mermaid
sequenceDiagram
    participant WH as GitHub webhook
    participant UC as ProposeReview
    participant UoW
    participant CH as CodeHost
    participant AG as Agents
    participant AP as ApproveProposal

    WH->>UC: PullRequestOpened(repo, number, closes)
    UC->>UoW: tasks linked to those issues
    UC->>CH: get_pull_request_diff(repo, number)
    UC->>AG: run_stage(code_review, diff and the task's criteria)
    AG-->>UC: comments and risks
    UC->>UC: picks reviewers by role and load
    UC->>UoW: proposals.add(github_action request_review)
    Note over UC,AP: the leader approves or adjusts the reviewers
    AP->>CH: request_review(repo, number, reviewers)
    AP->>CH: comment_on_pull_request(repo, number, comment)
```

### UC-12 · Sync progress from GitHub and close objectives

- **Trigger**: GitHub webhooks (`pull_request`, `issues`).
- **Result**: the board reflects real progress. Since **our board is the source of truth**, only state changes come in from GitHub and they're applied without a proposal.

| GitHub event | Effect on the task |
|---|---|
| PR opened that closes the issue | `in_progress` |
| PR ready for review | `review` |
| PR merged | `done` and checklist complete |
| Issue closed as completed, without a PR | `done` |
| Issue closed as not planned | No change; shown in the activity feed |
| Issue reopened | `todo` |

- GitHub events never move a task out of `done`, except reopening the issue. Events caused by the system's own writes are ignored (spec 008, FR-015).
- When all the tasks of an objective are `done`, the `Objective` closes.
- **Use cases**: `integrations/handle_pull_request_event.py`, `handle_issue_event.py`

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant WH as GitHub webhook
    participant UC as HandlePullRequestEvent
    participant UoW
    participant Bus as EventBus
    participant RP as Replan

    GH->>WH: POST /webhooks/github (pull_request merged)
    WH->>WH: validates the HMAC signature with GITHUB_WEBHOOK_SECRET
    alt invalid signature
        WH-->>GH: 401
    else valid
        WH->>UC: PullRequestMerged(repo, number, closes)
        WH-->>GH: 202
        UC->>UoW: project by repository and tasks by ExternalLink
        loop each linked task
            UC->>UC: status done and checklist complete
            UC->>UoW: tasks.save(task)
            UC->>Bus: publish(TaskStatusChanged)
        end
        UC->>UC: evaluates those tasks' objectives
        UC->>UoW: objective.done = true if all are done
        UC->>UoW: commit()
        UC->>Bus: publish(ObjectiveClosed)
        opt sprint ended with pending work
            UC->>RP: propose a replan (UC-13)
        end
    end
```

### UC-13 · Replan

- **Trigger**:
  - the leader asks for it with a reason ("a dev left", "a new client came in"),
  - the team changed (UC-02),
  - a sprint ended with pending work (UC-12).
- **Result**: a `replan` proposal with a diff over the current board (tasks that move between sprints, reassignments, new or discarded tasks) and its rationale. When approved, the diff is applied; `done` tasks are never touched. Automatic replans always wait for the leader, even with auto-approve (spec 008, FR-016).
- **Use case**: `planning/replan.py` (new `replan` stage with its diff schema).

```mermaid
sequenceDiagram
    actor L as Leader
    participant HTTP as HTTP planning
    participant UC as Replan
    participant UoW
    participant AG as Agents
    participant Bus as EventBus

    L->>HTTP: POST /api/projects/{id}/replan (reason)
    HTTP->>UC: launches in the background
    HTTP-->>L: 202
    UC->>UoW: approved plan, team and current board
    UC->>AG: run_stage(replan, plan, board, real velocity, reason)
    AG-->>UC: diff (move, reassign, add, discard) and rationale
    UC->>UC: validates the diff (no done tasks touched)
    UC->>UoW: proposals.add(Proposal kind replan)
    UC->>UoW: commit()
    UC->>Bus: publish(ProposalCreated)
    Note over UC,Bus: on approval, ApproveProposal applies the diff in a single transaction
```

### UC-14 · Follow the live activity

- **Trigger**: any project screen is open.
- **Result**: the UI sees live which agent is working, the new proposals and the board changes, without reloading ("Agent transparency"). Every event is also kept as the project's history.
- **Adapter**: `inbound/http/activity.py` exposes `GET /api/projects/{id}/events` as SSE (`sse-starlette`) and `GET /api/projects/{id}/activity` for the history. `PersistentEventBus` saves every event (its row id is the event's `seq`) before fanning it out; `FollowActivity` replays what a reconnecting client missed.

```mermaid
sequenceDiagram
    participant UI
    participant HTTP as HTTP SSE
    participant FA as FollowActivity
    participant Bus as PersistentEventBus
    participant UC as Any use case

    UI->>HTTP: GET /api/projects/{id}/events (Last-Event-ID: 41)
    HTTP->>FA: stream(project_id, after=41)
    FA->>Bus: subscribe(project_id) first, so nothing is lost
    FA->>FA: replay activity after 41 (or one resync if more than 200)
    FA-->>UI: id: 42 · event: proposal_resolved …
    UC->>Bus: publish(AgentStarted)
    Bus->>Bus: save as activity (seq 43)
    Bus-->>FA: event
    FA-->>UI: id: 43 · event: agent_started
    UI->>UI: refetches what changed
    Note over UI,HTTP: on a drop, EventSource reconnects with Last-Event-ID and gets what it missed
```

---

## Impact on the architecture

What these use cases add to what's already on `main`:

| Where | What's missing |
|---|---|
| `domain/plan.py` | Stages `general_spec`, `epic_specs`, `flow_diagrams`, `code_review`, `replan`, with their schemas |
| `domain/proposals.py` | `rejection_reason` in `Proposal` |
| `domain/project.py` | `Member.github_username`; `Objective` linked to a sprint and its tasks |
| `domain/events.py` | `TeamChanged`, `PlanApplied`, `IssuesPublished`, `ObjectiveClosed` |
| `application/ports/code_host.py` | `check_access`, `register_webhook`, `update_issue`, `get_pull_request_diff`, `comment_on_pull_request` |
| `application/ports/repositories.py` | `ExternalLinkRepository`, `ObjectiveRepository`; add `proposals`, `documents`, `links` and `objectives` to the `UnitOfWork` |
| `application/use_cases/planning/` | `RunPlanning` (back to back) is replaced by `StartPlanning` + `RunPlanningStep` |
| Background execution | Agents run in `asyncio.create_task` from the HTTP adapter; that task has its own DB session, not the request's |

## Open questions

1. ~~**UC-11**: does the system also open PRs?~~ **Resolved in spec 007**: no, it only requests reviews and comments. The team opens the PRs.
2. ~~**UC-04 reject**: does the agent redo the stage automatically with the reason, or does the leader decide when?~~ **Resolved**: it redoes it automatically with the reason; after 3 rejections in a row of the same stage it waits for the leader ([spec 002](../specs/002-agent-planning-pipeline/spec.md), FR-011).
3. ~~**UC-12**: does drift detection (sprint ended with pending work) propose a replan by itself, or just warn?~~ **Resolved**: it proposes the replan by itself, also on team changes, and it always waits for the leader's decision, even with auto-approve ([spec 008](../specs/008-github-sync-replanning/spec.md), FR-010 and FR-016).
