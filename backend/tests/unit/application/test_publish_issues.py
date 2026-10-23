import asyncio

import pytest

from app.application.use_cases.integrations.connect_repository import ConnectRepository
from app.application.use_cases.integrations.propose_issues import ProposeIssues
from app.application.use_cases.integrations.publish_issues import IssuesNotPublished, PublishIssues
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry, ApplyProposal
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.board import ChecklistItem, Task
from app.domain.errors import NothingToPublish, ProjectNotFound, PublicationPending, RepositoryNotConnected
from app.domain.integrations import ExternalLink, IssueRef
from tests.fakes import CodeHosts, InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run
REPO = "acme/app"


def _setup(tasks: int = 3, **fields):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(repository=REPO, **fields))
    ana = saved.members[0]
    for i in range(tasks):
        uow.tasks.add(
            Task(
                project_id=saved.id,
                key=f"US-{i + 1}",
                title=f"Task {i + 1}",
                position=i,
                assignee_id=ana.id if i == 0 else None,
                acceptance_criteria=["It works"],
                checklist=[ChecklistItem(text="It works")],
                type="bug" if i == 0 else "feature",
            )
        )
    uow.commit()
    return uow, saved.id, RecordingEventBus(), CodeHosts()


def _task_ids(uow, pid) -> list[int]:
    return [t.id for t in uow.tasks.list_by_project(pid)]


def _approve(uow, proposal_id, content=None):
    with uow.factory()() as unit:
        proposal = unit.proposals.get(proposal_id)
        proposal.adjust(content) if content is not None else proposal.approve()
        unit.proposals.save(proposal)
        unit.commit()


# ---------- ProposeIssues ----------


def test_propose_lists_every_task_without_an_issue():
    uow, pid, bus, _ = _setup()
    ids = _task_ids(uow, pid)
    uow.links.add(ExternalLink(project_id=pid, task_id=ids[0], kind="issue", repository=REPO, number=5, url="u"))
    uow.links.add(ExternalLink(project_id=pid, task_id=ids[1], kind="issue", repository=REPO, number=6, url="u", broken=True))
    uow.commit()

    proposal = run(ProposeIssues(uow, bus).execute(pid))
    assert (proposal.kind, proposal.key, proposal.status, proposal.agent) == ("github_action", "create_issues", "pending", "GitHub integration")
    # Task 1 is published; task 2's issue was deleted on GitHub, so it can be published again.
    assert proposal.content == {
        "repository": REPO,
        "tasks": [{"task_id": ids[1], "key": "US-2", "title": "Task 2"}, {"task_id": ids[2], "key": "US-3", "title": "Task 3"}],
    }
    [event] = bus.events
    assert (event.type, event.proposal_id, event.key, event.actor) == ("proposal_created", proposal.id, "create_issues", "system")


def test_propose_errors():
    uow, pid, bus, _ = _setup()
    with pytest.raises(ProjectNotFound):
        run(ProposeIssues(uow, bus).execute(99))

    pending = run(ProposeIssues(uow, bus).execute(pid))
    with pytest.raises(PublicationPending) as info:
        run(ProposeIssues(uow, bus).execute(pid))
    assert info.value.extra() == {"proposal_id": pending.id}

    empty_uow, empty_pid, _, _ = _setup(tasks=0)
    with pytest.raises(NothingToPublish):
        run(ProposeIssues(empty_uow, bus).execute(empty_pid))

    unconnected = InMemoryUnitOfWork()
    saved = unconnected.projects.add(project())
    unconnected.commit()
    with pytest.raises(RepositoryNotConnected):
        run(ProposeIssues(unconnected, bus).execute(saved.id))


def test_propose_calls_after_created_for_auto_approve():
    uow, pid, bus, _ = _setup()
    created: list[int] = []

    async def after_created(proposal_id: int) -> bool:
        created.append(proposal_id)
        return False

    proposal = run(ProposeIssues(uow, bus, after_created).execute(pid))
    assert created == [proposal.id]


def test_connecting_with_a_board_proposes_but_an_empty_board_doesnt():
    uow, pid, bus, hosts = _setup()
    uow.projects.save(uow.projects.get(pid).model_copy(update={"repository": None}))
    uow.commit()
    propose = ProposeIssues(uow, bus)
    run(ConnectRepository(uow, bus, hosts, None, on_connected=[propose.propose_pending]).execute(pid, REPO))
    run(ConnectRepository(uow, bus, hosts, None, on_connected=[propose.propose_pending]).execute(pid, REPO))
    assert len(uow.proposals.list_by_project(pid)) == 1  # the second connect finds it pending: no error

    empty_uow, empty_pid, _, _ = _setup(tasks=0)
    run(ProposeIssues(empty_uow, bus).propose_pending(empty_pid))
    assert empty_uow.proposals.list_by_project(empty_pid) == []


# ---------- PublishIssues ----------


def test_publish_creates_one_issue_per_task_with_links_and_own_writes():
    uow, pid, bus, hosts = _setup(github_token="ghp")
    with_user = uow.projects.get(pid)
    with_user.members[0].github_username = "anagomez"
    uow.projects.save(with_user)
    uow.commit()
    proposal = run(ProposeIssues(uow, bus).execute(pid))
    _approve(uow, proposal.id)

    run(PublishIssues(uow.factory(), bus, hosts).execute(proposal.id))
    uow.rollback()  # see what the publishing units committed

    issues = hosts.host.called("create_issue")
    assert [i["title"] for i in issues] == ["Task 1", "Task 2", "Task 3"]
    assert issues[0]["assignees"] == ["anagomez"] and issues[1]["assignees"] == []
    assert issues[0]["labels"] == ["type:bug", "priority:medium"]
    assert "- [ ] It works" in issues[0]["body"]
    assert hosts.tokens == ["ghp"]
    ids = _task_ids(uow, pid)
    links = uow.links.list_by_project(pid)
    assert [(link.task_id, link.number, link.repository, link.kind) for link in links] == [
        (ids[0], 1, REPO, "issue"),
        (ids[1], 2, REPO, "issue"),
        (ids[2], 3, REPO, "issue"),
    ]
    assert links[0].url == f"https://github.com/{REPO}/issues/1"
    assert [(w.number, w.action) for w in uow.own_writes.all()] == [(1, "issue_opened"), (2, "issue_opened"), (3, "issue_opened")]
    assert uow.proposals.get(proposal.id).result == {
        "created": [{"task_id": ids[0], "number": 1}, {"task_id": ids[1], "number": 2}, {"task_id": ids[2], "number": 3}],
        "failed": [],
    }
    [event] = bus.of_type("issues_published")
    assert event.created[0].number == 1 and event.failed == [] and event.proposal_id == proposal.id
    assert event.summary == f"Published 3 issue(s) in {REPO} (proposal #{proposal.id})"


def test_tasks_removed_from_the_proposal_are_not_published():
    uow, pid, bus, hosts = _setup()
    proposal = run(ProposeIssues(uow, bus).execute(pid))
    kept = {**proposal.content, "tasks": proposal.content["tasks"][2:]}
    _approve(uow, proposal.id, kept)

    run(PublishIssues(uow.factory(), bus, hosts).execute(proposal.id))
    uow.rollback()  # see what the publishing units committed
    assert [i["title"] for i in hosts.host.called("create_issue")] == ["Task 3"]
    # The removed ones can be published later.
    later = run(ProposeIssues(uow, bus).execute(pid))
    assert [t["title"] for t in later.content["tasks"]] == ["Task 1", "Task 2"]


def test_partial_failure_keeps_created_issues_and_retry_publishes_only_the_rest():
    uow, pid, bus, hosts = _setup()
    proposal = run(ProposeIssues(uow, bus).execute(pid))
    _approve(uow, proposal.id)
    real_create = hosts.host.create_issue
    rejected = {"Task 2"}

    async def flaky(repository, title, body, labels, assignees) -> IssueRef:
        if title in rejected:
            raise RuntimeError("GitHub answered 422: Validation Failed")
        return await real_create(repository, title, body, labels, assignees)

    hosts.host.create_issue = flaky  # type: ignore[method-assign]
    with pytest.raises(IssuesNotPublished):
        run(PublishIssues(uow.factory(), bus, hosts).execute(proposal.id))
    uow.rollback()  # see what the publishing units committed
    uow.rollback()  # see what the publishing units committed
    ids = _task_ids(uow, pid)
    assert [link.task_id for link in uow.links.list_by_project(pid)] == [ids[0], ids[2]]
    result = uow.proposals.get(proposal.id).result
    assert result["failed"] == [{"task_id": ids[1], "error": "GitHub answered 422: Validation Failed"}]
    assert [c["task_id"] for c in result["created"]] == [ids[0], ids[2]]
    assert bus.of_type("issues_published")[0].failed[0].task_id == ids[1]

    rejected.clear()
    run(PublishIssues(uow.factory(), bus, hosts).execute(proposal.id))
    uow.rollback()  # see what the publishing units committed
    assert [i["title"] for i in hosts.host.called("create_issue")] == ["Task 1", "Task 3", "Task 2"]  # never twice
    result = uow.proposals.get(proposal.id).result
    assert result["failed"] == [] and [c["task_id"] for c in result["created"]] == [ids[0], ids[2], ids[1]]


def test_missing_task_and_disconnected_repo():
    uow, pid, bus, hosts = _setup(tasks=1)
    proposal = run(ProposeIssues(uow, bus).execute(pid))
    content = {**proposal.content, "tasks": [*proposal.content["tasks"], {"task_id": 999, "title": "Ghost"}]}
    _approve(uow, proposal.id, content)
    with pytest.raises(IssuesNotPublished):
        run(PublishIssues(uow.factory(), bus, hosts).execute(proposal.id))
    uow.rollback()  # see what the publishing units committed
    uow.rollback()  # see what the publishing units committed
    assert uow.proposals.get(proposal.id).result["failed"] == [{"task_id": 999, "error": "The task no longer exists."}]

    uow.projects.save(uow.projects.get(pid).model_copy(update={"repository": None}))
    uow.commit()
    with pytest.raises(RepositoryNotConnected):
        run(PublishIssues(uow.factory(), bus, hosts).execute(proposal.id))
    uow.rollback()  # see what the publishing units committed
    uow.rollback()  # see what the publishing units committed


def test_auto_approve_publishes_through_the_applier_registry():
    uow, pid, bus, hosts = _setup(auto_approve=True)
    registry = ApplierRegistry()
    registry.register("github_action", PublishIssues(uow.factory(), bus, hosts).execute, key="create_issues")
    auto = AutoApprove(uow.factory(), bus, ApplyProposal(uow.factory(), bus, registry))

    proposal = run(ProposeIssues(uow, bus, auto.after_created).execute(pid))
    stored = uow.factory()().proposals.get(proposal.id)
    assert stored.status == "approved" and stored.auto_approved and not stored.apply_failed
    assert len(hosts.host.called("create_issue")) == 3


def test_failed_publication_is_flagged_on_the_proposal_for_retry():
    uow, pid, bus, hosts = _setup(tasks=1)
    registry = ApplierRegistry()
    registry.register("github_action", PublishIssues(uow.factory(), bus, hosts).execute, key="create_issues")
    proposal = run(ProposeIssues(uow, bus).execute(pid))
    _approve(uow, proposal.id)

    async def down(*args) -> IssueRef:
        raise RuntimeError("GitHub didn't answer")

    hosts.host.create_issue = down  # type: ignore[method-assign]
    run(ApplyProposal(uow.factory(), bus, registry).execute(proposal.id))
    stored = uow.factory()().proposals.get(proposal.id)
    assert stored.apply_failed and stored.apply_error == "1 issue(s) couldn't be created. Retry to publish them."
