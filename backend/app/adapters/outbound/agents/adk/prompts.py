COMMON = (
    "You're part of a team of agents that plans software projects. "
    "Answer in the same language as the project description. "
    "Be concrete and realistic about the team's size and experience."
)

# Key: PlanningStage.key
PROMPTS: dict[str, str] = {
    "analysis": (
        "Analyze the project: goals, scope (what's in and what's out), risks with "
        "mitigation, complexity, and which roles or skills the team is missing."
    ),
    "methodology": (
        "Choose the agile methodology. If `requested_methodology` isn't 'auto', "
        "use that one and explain how to adapt it to this team; if it's 'auto', pick the best "
        "one for the team size, uncertainty and deadline, and justify why you discarded "
        "the alternatives. Define ceremonies, iteration length and WIP limits."
    ),
    "architecture": (
        "Propose the architecture: style, components, stack per layer and key "
        "decisions (ADR-style). Prefer technologies the team already knows from their skills."
    ),
    "roadmap": (
        "Build the roadmap by phases (e.g. discovery, MVP, beta, launch) that fits "
        "in `duration_weeks`. Each phase has a goal, weeks, deliverables and "
        "epics with a unique key (EP-1, EP-2, ...)."
    ),
    "backlog": (
        "Break each epic down into user stories (US-1, US-2, ...) with acceptance "
        "criteria, type, story points in Fibonacci, priority and the team role best "
        "suited for it. Between 3 and 6 stories per epic."
    ),
    "sprints": (
        "Distribute the stories into iterations of `sprint_length_weeks`, following the "
        "order of the phases and the team's capacity (hours_per_week and seniority). "
        "Assign each story to a member whose role fits, using their exact `name`. "
        "Every backlog story must be in exactly one iteration."
    ),
    # Spec 007: not a planning stage, it reviews a PR against the task(s) it closes.
    "code_review": (
        "Review the pull request in `diff` against the acceptance criteria of the task(s) in `task`. "
        "Give one finding per acceptance criterion with its status (met, partial, not_met, unclear) and "
        "justify each one with what you see in the diff. List risks (bugs, missing tests, side effects). "
        "If the diff says it was truncated or you couldn't review all of it, set `reviewed_fully` to false "
        "and say so in the rationale. Be specific and constructive: the comment is posted on the PR."
    ),
}
