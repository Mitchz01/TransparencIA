"""Sample plan to run without an API key (MOCK_AGENTS=1).
It follows the same schemas the real agents return."""

from app.domain import plan as schemas


def _story(key, epic, title, points, role, priority="medium", type_="feature"):
    return {
        "key": key,
        "epic_key": epic,
        "title": title,
        "description": f"As a user I want to {title.lower()} to move the product forward.",
        "acceptance_criteria": ["Works on desktop and mobile", "Has basic tests"],
        "type": type_,
        "points": points,
        "priority": priority,
        "role": role,
    }


MOCK_PLAN = {
    "analysis": {
        "summary": "Web platform to manage projects with AI-assisted planning.",
        "goals": ["Have a demoable MVP", "Validate it with 3 real teams"],
        "in_scope": ["Project and team setup", "Kanban board", "Phased roadmap"],
        "out_of_scope": ["Billing", "Native mobile app"],
        "risks": [
            {
                "description": "Inconsistent LLM answers",
                "impact": "high",
                "mitigation": "Use structured outputs with a schema",
            },
            {
                "description": "Little time for the frontend",
                "impact": "medium",
                "mitigation": "Use ready-made components",
            },
        ],
        "complexity": "medium",
        "team_gaps": ["UX design"],
        "rationale": "The scope is clear for an MVP, but the agents are new to the team. The main risk is the LLM output, so the plan leans on structured schemas.",
    },
    "methodology": {
        "methodology": "scrumban",
        "rationale": "Small team with high uncertainty: short iterations with continuous flow and WIP limits.",
        "sprint_length_weeks": 2,
        "ceremonies": [
            {"name": "Daily", "frequency": "Daily, 15 min", "purpose": "Sync up and unblock"},
            {"name": "Planning", "frequency": "Every 2 weeks", "purpose": "Pick the iteration's work"},
            {"name": "Retro", "frequency": "Every 2 weeks", "purpose": "Improve the process"},
        ],
        "wip_limits": [
            {"column": "in_progress", "limit": 3},
            {"column": "review", "limit": 2},
        ],
        "alternatives": [
            {"methodology": "scrum", "why_not": "Too many ceremonies for a team of 3-4 people."},
            {"methodology": "kanban", "why_not": "The team needs iteration cut-offs for demos."},
        ],
    },
    "architecture": {
        "style": "Modular monolith",
        "summary": "React SPA that consumes a FastAPI API; the agents run in the backend with Google ADK.",
        "components": [
            {"name": "Web app", "responsibility": "UI, board and roadmap", "technology": "React + Vite"},
            {"name": "API", "responsibility": "Projects, tasks and agent streaming", "technology": "FastAPI"},
            {"name": "Agents", "responsibility": "Generate the plan", "technology": "Google ADK + Gemini"},
            {"name": "Database", "responsibility": "Persistence", "technology": "SQLite"},
        ],
        "stack": [
            {"layer": "Frontend", "technology": "React + Tailwind", "reason": "Fast to iterate"},
            {"layer": "Backend", "technology": "FastAPI", "reason": "Async and typed with Pydantic"},
            {"layer": "AI", "technology": "Gemini", "reason": "Native structured outputs"},
        ],
        "decisions": [
            {
                "title": "Structured outputs",
                "decision": "Each agent returns JSON with a schema",
                "rationale": "It's persisted directly as cards",
            }
        ],
        "rationale": "A modular monolith is the simplest thing a small team can run and change fast. The stack follows the team's skills.",
    },
    "roadmap": {
        "phases": [
            {
                "name": "Foundations",
                "goal": "Technical base and project setup",
                "start_week": 1,
                "end_week": 2,
                "deliverables": ["Repo and CI", "Project and team setup"],
                "epics": [
                    {"key": "EP-1", "title": "Setup", "description": "Project infrastructure"},
                    {"key": "EP-2", "title": "Projects and team", "description": "Project and member CRUD"},
                ],
            },
            {
                "name": "MVP",
                "goal": "Plan generation and board",
                "start_week": 3,
                "end_week": 4,
                "deliverables": ["Agent pipeline", "Kanban board"],
                "epics": [
                    {"key": "EP-3", "title": "Agents", "description": "Pipeline that generates the plan"},
                    {"key": "EP-4", "title": "Board", "description": "Kanban with drag & drop"},
                ],
            },
            {
                "name": "Beta",
                "goal": "Polish and feedback",
                "start_week": 5,
                "end_week": 6,
                "deliverables": ["Replanning", "Metrics"],
                "epics": [{"key": "EP-5", "title": "Insights", "description": "Velocity and replanning"}],
            },
        ],
        "rationale": "Foundations first so the MVP has a base; the beta is kept small to fit the deadline.",
    },
    "backlog": {
        "stories": [
            _story("US-1", "EP-1", "Set up repo and CI", 2, "DevOps", "high", "chore"),
            _story("US-2", "EP-1", "Define the data model", 3, "Backend", "high"),
            _story("US-3", "EP-2", "Create a project with a description", 3, "Frontend", "high"),
            _story("US-4", "EP-2", "Enter members and roles", 3, "Frontend", "high"),
            _story("US-5", "EP-3", "Research Google ADK", 2, "Backend", "high", "spike"),
            _story("US-6", "EP-3", "Chain the plan agents", 8, "Backend", "high"),
            _story("US-7", "EP-3", "Show agent progress", 5, "Frontend"),
            _story("US-8", "EP-4", "See the board by columns", 5, "Frontend", "high"),
            _story("US-9", "EP-4", "Move cards with drag & drop", 3, "Frontend"),
            _story("US-10", "EP-5", "Replan a sprint", 8, "Backend", "low"),
            _story("US-11", "EP-5", "Velocity chart", 5, "Frontend", "low"),
        ],
        "rationale": "Each epic is split into small stories the team can finish in one iteration; the riskiest ones (agents) are high priority.",
    },
    "sprints": {
        "sprints": [
            {"number": 1, "name": "Sprint 1", "goal": "Base ready", "phase": "Foundations",
             "story_keys": ["US-1", "US-2", "US-3", "US-4"]},
            {"number": 2, "name": "Sprint 2", "goal": "Plan generated by agents", "phase": "MVP",
             "story_keys": ["US-5", "US-6", "US-7", "US-8", "US-9"]},
            {"number": 3, "name": "Sprint 3", "goal": "Beta", "phase": "Beta",
             "story_keys": ["US-10", "US-11"]},
        ],
        # The names don't match the real team: assignment falls back to matching by role.
        "assignments": [],
        "rationale": "The iterations follow the roadmap phases and stay within the team's capacity.",
    },
}

# Fail fast if the mock drifts from the schemas.
schemas.Analysis.model_validate(MOCK_PLAN["analysis"])
schemas.MethodologyDecision.model_validate(MOCK_PLAN["methodology"])
schemas.Architecture.model_validate(MOCK_PLAN["architecture"])
schemas.Roadmap.model_validate(MOCK_PLAN["roadmap"])
schemas.Backlog.model_validate(MOCK_PLAN["backlog"])
schemas.SprintPlanning.model_validate(MOCK_PLAN["sprints"])


# Spec 007: the code reviewer isn't a plan stage, so its sample output lives apart from MOCK_PLAN.
MOCK_CODE_REVIEW = {
    "summary": "Adds the requested behavior and wires it into the existing flow.",
    "findings": [
        {"criterion": "Works on desktop and mobile", "status": "partial", "comment": "The layout changes cover desktop; no mobile breakpoint is touched."},
        {"criterion": "Has basic tests", "status": "met", "comment": "A test covers the main path."},
    ],
    "risks": ["No test for the error path."],
    "reviewed_fully": True,
    "rationale": "Close to done: check the mobile layout before merging.",
}
schemas.CodeReview.model_validate(MOCK_CODE_REVIEW)

# Spec 008: the replan's base output; MockPlanningAgents fills `changes` from the board it gets.
MOCK_REPLAN = {
    "changes": [],
    "rationale": "The plan still fits the team and the board: nothing needs to change.",
}
schemas.Replan.model_validate(MOCK_REPLAN)

# What MockPlanningAgents returns per stage key.
MOCK_OUTPUTS = {**MOCK_PLAN, "code_review": MOCK_CODE_REVIEW, "replan": MOCK_REPLAN}


# ---------- Writer: specs and diagrams (spec 006) ----------
#
# Built from the plan they describe, so MockPlanningAgents writes them from any project's
# approved context with the same functions (the samples below are the sample plan's).

SAMPLE_PROJECT = {"name": "Agile Planner", "description": "Jira-like tool where AI agents plan the work."}


def _label(text: str) -> str:
    """Safe inside a quoted Mermaid label: no quotes, brackets or HTML."""
    return "".join(" " if c in '"[](){}<>|' else c for c in text).strip() or "Step"


def _scenarios(story: dict) -> list[str]:
    return [
        f"{n}. **Given** {story['title'].lower()} is available, **When** the user uses it, **Then** {criterion[0].lower()}{criterion[1:]}"
        for n, criterion in enumerate(story.get("acceptance_criteria") or ["It works as described"], 1)
    ]


def _story_section(n: int, story: dict) -> list[str]:
    priority = {"high": "P1", "medium": "P2", "low": "P3"}.get(story.get("priority", "medium"), "P2")
    return [
        f"### User Story {n} - {story['key']} {story['title']} (Priority: {priority})",
        "",
        story.get("description", ""),
        "",
        "**Acceptance Scenarios**:",
        "",
        *_scenarios(story),
        "",
    ]


def general_spec_output(project: dict, analysis: dict, roadmap: dict, backlog: dict) -> dict:
    epics = [epic for phase in roadmap.get("phases", []) for epic in phase.get("epics", [])]
    stories = backlog.get("stories", [])
    main = [next(s for s in stories if s["epic_key"] == e["key"]) for e in epics if any(s["epic_key"] == e["key"] for s in stories)]
    lines = [
        f"# Feature Specification: {project['name']}",
        "",
        project.get("description", ""),
        "",
        "## User Scenarios & Testing",
        "",
        *[line for n, story in enumerate(main, 1) for line in _story_section(n, story)],
        "### Edge Cases",
        "",
        *[f"- {risk['description']}: {risk['mitigation']}" for risk in analysis.get("risks", [])],
        "",
        "## Requirements",
        "",
        "### Functional Requirements",
        "",
        *[f"- **FR-{n:03}**: The system MUST cover {item[0].lower()}{item[1:]}." for n, item in enumerate(analysis.get("in_scope", []), 1)],
        "",
        "### Key Entities",
        "",
        *[f"- **{epic['title']}**: {epic['description']}" for epic in epics],
        "",
        "## Success Criteria",
        "",
        "### Measurable Outcomes",
        "",
        *[f"- **SC-{n:03}**: {goal}." for n, goal in enumerate(analysis.get("goals", []), 1)],
    ]
    return {
        "title": f"General spec: {project['name']}",
        "markdown": "\n".join(lines),
        "rationale": "It follows the approved plan: one main story per roadmap epic, the analysis risks as edge cases and its goals as success criteria.",
    }


def epic_spec_output(epic: dict, stories: list[dict]) -> dict:
    lines = [
        f"# Feature Specification: {epic['key']} {epic['title']}",
        "",
        epic.get("description", ""),
        "",
        "## User Scenarios & Testing",
        "",
        *[line for n, story in enumerate(stories, 1) for line in _story_section(n, story)],
        "### Edge Cases",
        "",
        "- What if the user leaves halfway? Nothing is saved until the step is confirmed.",
        "",
        "## Requirements",
        "",
        "### Functional Requirements",
        "",
        *[f"- **FR-{n:03}**: The system MUST let the user {s['title'][0].lower()}{s['title'][1:]}." for n, s in enumerate(stories, 1)],
        "",
        "## Success Criteria",
        "",
        "### Measurable Outcomes",
        "",
        f"- **SC-001**: 100% of the {len(stories)} stories of {epic['key']} meet their acceptance criteria.",
    ]
    return {
        "epic_key": epic["key"],
        "title": epic["title"],
        "markdown": "\n".join(lines),
        "rationale": f"Each of the {len(stories)} stories of {epic['key']} becomes a user story with its acceptance criteria as scenarios.",
    }


def flow_diagrams_output(architecture: dict, roadmap: dict) -> dict:
    components = architecture.get("components", [])
    nodes = [f'    C{n}["{_label(c["name"])}"]' for n, c in enumerate(components, 1)]
    links = [f"    C{n} --> C{n + 1}" for n in range(1, len(components))]
    diagrams = [
        {
            "title": "Architecture",
            "kind": "architecture",
            "mermaid": "\n".join(["flowchart LR", *(nodes or ['    C1["App"]']), *links]),
        }
    ]
    for phase in roadmap.get("phases", []):
        steps = [f'    S{n}["{_label(e["title"])}"]' for n, e in enumerate(phase.get("epics", []), 1)]
        if not steps:
            continue
        arrows = [f"    S{n} --> S{n + 1}" for n in range(1, len(steps))]
        diagrams.append(
            {"title": f"{phase['name']} journey", "kind": "flow", "mermaid": "\n".join(["flowchart TD", *steps, *arrows])}
        )
    return {
        "diagrams": diagrams,
        "rationale": "The architecture diagram follows the approved components; each journey walks through the epics of a roadmap phase.",
    }


MOCK_DOCUMENTS = {
    "general_spec": general_spec_output(SAMPLE_PROJECT, MOCK_PLAN["analysis"], MOCK_PLAN["roadmap"], MOCK_PLAN["backlog"]),
    "epic_spec": epic_spec_output(
        MOCK_PLAN["roadmap"]["phases"][0]["epics"][0],
        [s for s in MOCK_PLAN["backlog"]["stories"] if s["epic_key"] == "EP-1"],
    ),
    "flow_diagrams": flow_diagrams_output(MOCK_PLAN["architecture"], MOCK_PLAN["roadmap"]),
}

schemas.GeneralSpec.model_validate(MOCK_DOCUMENTS["general_spec"])
schemas.EpicSpec.model_validate(MOCK_DOCUMENTS["epic_spec"])
for _diagram in schemas.FlowDiagrams.model_validate(MOCK_DOCUMENTS["flow_diagrams"]).diagrams:
    schemas.DiagramProposal.model_validate(_diagram.model_dump())  # also renders (check_mermaid)
