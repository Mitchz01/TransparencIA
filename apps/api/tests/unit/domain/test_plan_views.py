from datetime import date, datetime, timedelta, timezone

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.board import Task
from app.domain.plan_views import build_plan_views
from app.domain.project import Project
from app.domain.proposals import Proposal

APPROVED_AT = datetime(2026, 10, 1, 9, tzinfo=timezone.utc)
TODAY = date(2026, 10, 11)  # 10 days later → week 2


def _project(stages=(), **overrides) -> Project:
    return Project(id=1, name="P", description="D", plan={k: MOCK_PLAN[k] for k in stages} or None, **overrides)


def _proposal(key: str, status: str = "approved", minutes: int = 0, **overrides) -> Proposal:
    created = APPROVED_AT + timedelta(minutes=minutes)
    resolved = created if status != "pending" else None
    return Proposal(
        id=minutes + 1, project_id=1, kind="plan_stage", key=key, agent=f"{key} agent", content=MOCK_PLAN[key],
        rationale=f"why {key}", status=status, created_at=created, resolved_at=resolved, **overrides,
    )


def _task(epic: str, points: int, done: bool) -> Task:
    return Task(project_id=1, key="US", epic_key=epic, title="t", points=points, status="done" if done else "todo")


def test_draft_project_has_nothing_generated():
    views = build_plan_views(_project(), [], [], TODAY)
    assert {views.roadmap.status, views.methodology.status, views.architecture.status} == {"not_generated"}
    assert views.roadmap.content is None and views.roadmap.origin is None


def test_roadmap_progress_per_epic_phase_and_total():
    tasks = [_task("EP-1", 3, True), _task("EP-1", 3, True), _task("EP-1", 3, False), _task("EP-1", 3, False), _task("", 5, True)]
    views = build_plan_views(_project(["roadmap"]), [_proposal("roadmap")], tasks, TODAY)
    roadmap = views.roadmap.content
    foundations = roadmap.phases[0]
    ep1, ep2 = foundations.epics
    assert (ep1.progress.tasks, ep1.progress.tasks_done, ep1.progress.points, ep1.progress.points_done) == (4, 2, 12, 6)
    assert ep1.has_tasks and not ep2.has_tasks and ep2.progress.tasks == 0
    assert foundations.progress.points == 12
    assert roadmap.progress.tasks == 5 and roadmap.progress.points_done == 11  # includes the task without an epic


def test_current_week_only_once_the_board_exists():
    proposals = [_proposal("roadmap"), _proposal("sprints", minutes=1)]
    no_board = build_plan_views(_project(["roadmap", "sprints"]), proposals, [], TODAY).roadmap.content
    assert no_board.current_week is None and no_board.current_phase is None

    ready = build_plan_views(_project(["roadmap", "sprints"], status="ready"), proposals, [], TODAY).roadmap.content
    assert (ready.current_week, ready.current_phase, ready.overdue) == (2, "Foundations", False)

    late = build_plan_views(_project(["roadmap", "sprints"], status="ready"), proposals, [], TODAY + timedelta(weeks=10))
    assert (late.roadmap.content.current_week, late.roadmap.content.overdue) == (6, True)


def test_methodology_chosen_by():
    agents = build_plan_views(_project(["methodology"]), [_proposal("methodology")], [], TODAY).methodology
    assert agents.content.chosen_by == "agents" and agents.content.decision.methodology == "scrumban"
    leader = build_plan_views(_project(["methodology"], requested_methodology="kanban"), [_proposal("methodology")], [], TODAY)
    assert leader.methodology.content.chosen_by == "leader"


def test_architecture_in_approved_order():
    views = build_plan_views(_project(["architecture"]), [_proposal("architecture")], [], TODAY)
    content = views.architecture.content
    assert [c.name for c in content.components] == [c["name"] for c in MOCK_PLAN["architecture"]["components"]]
    assert len(content.decisions) == len(MOCK_PLAN["architecture"]["decisions"])


def test_origin_and_pending():
    proposals = [
        _proposal("methodology", status="rejected", minutes=0, rejection_reason="No"),
        _proposal("methodology", status="adjusted", minutes=1),
        _proposal("roadmap", status="approved", minutes=2, auto_approved=True),
        _proposal("architecture", status="pending", minutes=3),
    ]
    views = build_plan_views(_project(["methodology", "roadmap"]), proposals, [], TODAY)
    assert views.methodology.origin.decision == "adjusted" and views.methodology.origin.rationale == "why methodology"
    assert views.roadmap.origin.decision == "auto"
    assert views.architecture.status == "pending" and views.architecture.content is None


def test_approved_stage_with_a_new_pending_proposal_stays_approved():
    proposals = [_proposal("roadmap", minutes=0), _proposal("roadmap", status="pending", minutes=1)]
    views = build_plan_views(_project(["roadmap"]), proposals, [], TODAY)
    assert views.roadmap.status == "approved" and views.roadmap.origin.decision == "leader"
