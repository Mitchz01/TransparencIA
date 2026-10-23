COMMON = (
    "You're part of a team of agents that plans software projects. "
    "Answer in the same language as the project description. "
    "Be concrete and realistic about the team's size and experience. "
    "Fill `rationale` with why you decided this, in 2-3 sentences: the leader reads it before approving. "
    "If the context has `feedback`, the leader rejected your previous proposal (`rejected_content`) "
    "or it broke a rule: fix it following `feedback.reason` and keep what wasn't questioned."
)

# Key: PlanningStage.key
PROMPTS: dict[str, str] = {
    "analysis": (
        "Analyze the project: goals, scope (what's in and what's out), risks with "
        "mitigation, complexity, and which roles or skills the team is missing."
    ),
    "methodology": (
        "Choose the agile methodology (scrum, kanban, scrumban, xp or shape_up). "
        "If `project.requested_methodology` isn't 'auto', `methodology` MUST be exactly that one: "
        "the leader already chose it; explain in `rationale` how to adapt it to this team. "
        "If it's 'auto', pick the best one for the team size, uncertainty and deadline, and list "
        "at least two discarded alternatives in `alternatives`, each with its `why_not`. "
        "Define ceremonies, iteration length (1-4 weeks) and WIP limits."
    ),
    "architecture": (
        "Propose the architecture: style, components, stack per layer and key "
        "decisions (ADR-style). Prefer technologies the team already knows from their skills."
    ),
    "roadmap": (
        "Build the roadmap by phases (e.g. discovery, MVP, beta, launch) that fits "
        "in `duration_weeks`; if the scope doesn't fit, cut the scope, never the deadline. "
        "Each phase has a goal, weeks, deliverables and "
        "epics with a unique key (EP-1, EP-2, ...)."
    ),
    "backlog": (
        "Break each roadmap epic down into user stories with unique keys (US-1, US-2, ...), "
        "acceptance criteria, type, story points in Fibonacci, priority and the team role best "
        "suited for it (use the roles of `project.members` when one fits). Between 3 and 6 "
        "stories per epic. Every `epic_key` MUST be the key of an epic in the roadmap."
    ),
    "sprints": (
        "Distribute the stories into iterations of `capacity.sprint_length_weeks`, following the "
        "order of the roadmap phases. The story points of an iteration MUST NOT exceed "
        "`capacity.points_per_sprint` (it comes from hours_per_week and seniority; "
        "`capacity.members` has each member's share). Every backlog story must be in exactly one "
        "iteration. Assign each story to a member whose role fits, using their exact `name` from "
        "`project.members`; leave a story unassigned if nobody has a fitting role."
    ),
}
