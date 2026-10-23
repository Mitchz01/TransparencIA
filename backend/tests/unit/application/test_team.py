"""Spec 015, US4 to US6: the invitation link, joining, permissions and managing the team."""

import asyncio

import pytest

from app.application.dto import JoinRequest, MemberUpdate, ProjectCreate
from app.application.use_cases.accounts.authorize import AuthorizeAccess
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.invitation import (
    DisableInvitation,
    GetInvitation,
    PreviewInvitation,
    RenewInvitation,
)
from app.application.use_cases.projects.team import JoinProject, RemoveMember, UpdateMember
from app.domain.board import Sprint, Task
from app.domain.errors import (
    Forbidden,
    InvitationNotFound,
    LastLeader,
    MemberNotFound,
    ProjectNotFound,
    SprintNotFound,
    TaskNotFound,
    ValidationFailed,
)
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, account


def _setup():
    uow = InMemoryUnitOfWork()
    ana = account(uow, role="Backend", seniority="senior", hours_per_week=30)
    project = CreateProject(uow).execute(ProjectCreate(name="Online store", description="Sell online."), ana)
    return uow, ana, project


def _join(uow, token, who, bus=None, handlers=(), role=None):
    return asyncio.run(JoinProject(uow, bus or RecordingEventBus(), handlers).execute(token, who, JoinRequest(role=role)))


def _joined(uow, project, name="Beto Díaz", **profile):
    who = account(uow, name, **({"role": "Design", "seniority": "junior"} | profile))
    _join(uow, project.invite_token, who)
    return who, next(m for m in uow.projects.get(project.id).members if m.account_id == who.id)


# ---------- US4: invitation and join ----------


def test_join_adds_a_member_from_the_profile_and_publishes_team_changed():
    uow, _, project = _setup()
    beto = account(uow, "Beto Díaz", role="Design", seniority="junior", skills=["Figma"], github_username="beto", avatar_url="/avatars/beto.jpg")
    bus, received = RecordingEventBus(), []

    async def handler(event):
        received.append(event)

    result = _join(uow, project.invite_token, beto, bus, [handler])

    assert result.project_id == project.id and result.joined
    member = uow.projects.get(project.id).members[1]
    assert (member.name, member.role, member.seniority, member.hours_per_week, member.skills) == ("Beto Díaz", "Design", "junior", 20, ["Figma"])
    assert (member.account_id, member.permission, member.github_username, member.avatar_url) == (beto.id, "member", "beto", "/avatars/beto.jpg")
    [event] = bus.events
    assert event.type == "team_changed" and event.joined == ["Beto Díaz"] and event.summary == "Team changed: Beto Díaz joined"
    assert [e.type for e in received] == ["team_changed"]  # spec 008's drift handler hears it


def test_joining_twice_changes_nothing():
    uow, ana, project = _setup()
    bus = RecordingEventBus()
    assert _join(uow, project.invite_token, ana, bus).joined is False
    assert len(uow.projects.get(project.id).members) == 1 and bus.events == []


def test_join_needs_a_role_and_a_valid_token():
    uow, _, project = _setup()
    leo = account(uow, "Leo Ruiz")
    with pytest.raises(ValidationFailed) as error:
        _join(uow, project.invite_token, leo)
    assert [e.field for e in error.value.errors] == ["role"]
    assert _join(uow, project.invite_token, leo, role="QA").joined
    with pytest.raises(InvitationNotFound):
        _join(uow, "nope", leo)


def test_same_name_gets_a_number():
    uow, _, project = _setup()
    _, member = _joined(uow, project, "Ana Gómez", email="ana2@team.dev")
    assert member.name == "Ana Gómez 2"


def test_preview_shows_only_the_name_and_leaders():
    uow, ana, project = _setup()
    preview = PreviewInvitation(uow).execute(project.invite_token, None)
    assert preview.model_dump() == {"project_name": "Online store", "leaders": ["Ana Gómez"], "already_member": False}
    assert PreviewInvitation(uow).execute(project.invite_token, ana).already_member
    with pytest.raises(InvitationNotFound):
        PreviewInvitation(uow).execute("nope", None)


def test_renewing_replaces_the_link_and_disabling_turns_it_off():
    uow, _, project = _setup()
    assert GetInvitation(uow).execute(project.id).model_dump() == {"active": True, "token": project.invite_token}

    renewed = RenewInvitation(uow).execute(project.id)
    assert renewed.active and renewed.token != project.invite_token
    with pytest.raises(InvitationNotFound):
        PreviewInvitation(uow).execute(project.invite_token, None)

    DisableInvitation(uow).execute(project.id)
    assert GetInvitation(uow).execute(project.id).model_dump() == {"active": False, "token": None}
    with pytest.raises(InvitationNotFound):
        PreviewInvitation(uow).execute(renewed.token, None)
    assert RenewInvitation(uow).execute(project.id).active  # back on, with a new link
    with pytest.raises(ProjectNotFound):
        GetInvitation(uow).execute(99)


# ---------- US5: who can do what ----------


def test_authorize_by_resource():
    uow, ana, project = _setup()
    beto, beto_member = _joined(uow, project)
    outsider = account(uow, "Carla Paz")
    sprint = uow.sprints.add(Sprint(project_id=project.id, number=1, name="S1", goal="g"))
    task = uow.tasks.add(Task(project_id=project.id, key="US-1", title="Login"))
    uow.commit()
    authorize = AuthorizeAccess(uow)

    assert authorize.execute(ana, "project", project.id, "manage").permission == "leader"
    assert authorize.execute(beto, "task", task.id, "work").id == beto_member.id
    with pytest.raises(Forbidden):
        authorize.execute(beto, "sprint", sprint.id, "manage")
    with pytest.raises(ProjectNotFound):
        authorize.execute(outsider, "project", project.id, "view")
    with pytest.raises(TaskNotFound):
        authorize.execute(outsider, "task", task.id, "view")
    with pytest.raises(SprintNotFound):
        authorize.execute(ana, "sprint", 999, "view")
    with pytest.raises(MemberNotFound):
        authorize.execute(outsider, "member", beto_member.id, "manage")
    assert authorize.allows(beto, "project", project.id, "view") and not authorize.allows(outsider, "project", project.id, "view")


# ---------- US6: manage the team ----------


def _update(uow, project_id, member_id, bus=None, **fields):
    return asyncio.run(UpdateMember(uow, bus or RecordingEventBus()).execute(project_id, member_id, MemberUpdate(**fields)))


def test_leader_edits_a_member_without_touching_the_profile():
    uow, _, project = _setup()
    beto, member = _joined(uow, project)
    bus = RecordingEventBus()
    edited = _update(uow, project.id, member.id, bus, role="Frontend", seniority="mid", hours_per_week=30)
    changed = next(m for m in edited.members if m.id == member.id)
    assert (changed.role, changed.seniority, changed.hours_per_week) == ("Frontend", "mid", 30)
    assert uow.accounts.get(beto.id).role == "Design"
    [event] = bus.events
    assert event.changed[0].fields == ["role", "seniority", "hours_per_week"]


def test_permission_changes_publish_nothing_and_a_leader_always_remains():
    uow, _, project = _setup()
    _, member = _joined(uow, project)
    ana_member = uow.projects.get(project.id).members[0]
    bus = RecordingEventBus()

    _update(uow, project.id, member.id, bus, permission="leader")
    assert bus.events == []
    _update(uow, project.id, ana_member.id, bus, permission="member")  # Beto still leads
    with pytest.raises(LastLeader):
        _update(uow, project.id, member.id, bus, permission="member")


def test_update_member_errors():
    uow, _, project = _setup()
    _, member = _joined(uow, project)
    with pytest.raises(ValidationFailed) as error:
        _update(uow, project.id, member.id, name="Ana Gómez", hours_per_week=0)
    assert {e.field for e in error.value.errors} == {"name", "hours_per_week"}
    with pytest.raises(ValidationFailed):
        _update(uow, project.id, member.id)
    with pytest.raises(MemberNotFound):
        _update(uow, project.id, 999, role="QA")
    with pytest.raises(ProjectNotFound):
        _update(uow, 999, member.id, role="QA")


def _remove(uow, project_id, member_id, actor, bus=None):
    asyncio.run(RemoveMember(uow, bus or RecordingEventBus()).execute(project_id, member_id, actor))


def test_leader_removes_a_member_and_their_pending_tasks_are_unassigned():
    uow, _, project = _setup()
    _, carla = _joined(uow, project, "Carla Paz")
    pending = uow.tasks.add(Task(project_id=project.id, key="US-1", title="Login", assignee_id=carla.id, status="in_progress"))
    done = uow.tasks.add(Task(project_id=project.id, key="US-2", title="Signup", assignee_id=carla.id, status="done"))
    uow.commit()
    leader = uow.projects.get(project.id).members[0]
    bus = RecordingEventBus()

    _remove(uow, project.id, carla.id, leader, bus)

    assert [m.name for m in uow.projects.get(project.id).members] == ["Ana Gómez"]
    assert uow.tasks.get(pending.id).assignee_id is None and uow.tasks.get(done.id).assignee_id == carla.id
    assert bus.events[0].left == ["Carla Paz"]


def test_members_can_only_leave_and_the_last_leader_cant():
    uow, _, project = _setup()
    _, beto = _joined(uow, project)
    _, carla = _joined(uow, project, "Carla Paz")
    leader = uow.projects.get(project.id).members[0]

    with pytest.raises(Forbidden):
        _remove(uow, project.id, carla.id, beto)
    _remove(uow, project.id, beto.id, beto)  # leaving
    assert beto.id not in [m.id for m in uow.projects.get(project.id).members]
    with pytest.raises(LastLeader):
        _remove(uow, project.id, leader.id, leader)
