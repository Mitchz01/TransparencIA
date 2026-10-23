import asyncio

from app.application.use_cases.integrations.close_discarded_issue import CloseDiscardedIssue
from app.application.use_cases.integrations.sync_task_issue import SyncTaskIssue
from app.domain.board import ChecklistItem, Task
from app.domain.integrations import ExternalLink
from tests.fakes import CodeHosts, InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run
REPO = "acme/app"


def _setup(link_repo: str = REPO, published: bool = True, **fields):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(repository=REPO, github_token="ghp", **fields))
    ana = saved.members[0]
    saved.members[0].github_username = "anagomez"
    uow.projects.save(saved)
    task = uow.tasks.add(
        Task(
            project_id=saved.id,
            key="US-1",
            title="Login (edited)",
            assignee_id=ana.id,
            checklist=[ChecklistItem(text="Form", done=True)],
            priority="high",
        )
    )
    if published:
        uow.links.add(ExternalLink(project_id=saved.id, task_id=task.id, kind="issue", repository=link_repo, number=12, url="u12"))
    uow.commit()
    return uow, task.id, RecordingEventBus(), CodeHosts()


# ---------- SyncTaskIssue ----------


def test_edit_updates_the_issue_without_a_proposal():
    uow, task_id, bus, hosts = _setup()
    assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(task_id)) is True
    [update] = hosts.host.called("update_issue")
    assert (update["repository"], update["number"], update["title"]) == (REPO, 12, "Login (edited)")
    assert update["assignees"] == ["anagomez"] and update["labels"] == ["type:feature", "priority:high"]
    assert "- [x] Form" in update["body"]
    assert hosts.tokens == ["ghp"]
    uow.rollback()
    assert uow.proposals.list_by_project(uow.tasks.get(task_id).project_id) == []
    assert [(w.number, w.action) for w in uow.own_writes.all()] == [(12, "issue_edited")]
    [event] = bus.events
    assert (event.type, event.task_id, event.number, event.broken) == ("issue_updated", task_id, 12, False)
    assert event.summary == "Updated issue #12 with the changes to US-1"


def test_unpublished_task_old_repo_or_disconnected_project_send_nothing():
    for uow, task_id, bus, hosts in (_setup(published=False), _setup(link_repo="acme/old")):
        assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(task_id)) is False
        assert hosts.host.calls == [] and bus.events == []

    uow, task_id, bus, hosts = _setup()
    project_id = uow.tasks.get(task_id).project_id
    uow.projects.save(uow.projects.get(project_id).model_copy(update={"repository": None}))
    uow.commit()
    assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(task_id)) is False
    assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(999)) is False
    assert hosts.host.calls == []


def test_issue_deleted_on_github_marks_the_link_broken():
    uow, task_id, bus, hosts = _setup()
    hosts.host.deleted_issues.add(12)
    assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(task_id)) is True
    uow.rollback()
    assert uow.links.get_issue(task_id).broken is True
    assert uow.own_writes.all() == []
    assert bus.events[0].broken is True
    # A broken link isn't synced again.
    assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(task_id)) is False


def test_github_failure_doesnt_raise():
    uow, task_id, bus, hosts = _setup()

    async def down(*args) -> bool:
        raise RuntimeError("GitHub didn't answer")

    hosts.host.update_issue = down  # type: ignore[method-assign]
    assert run(SyncTaskIssue(uow.factory(), bus, hosts).execute(task_id)) is False
    assert bus.events == []


# ---------- CloseDiscardedIssue ----------


def test_discarded_task_closes_its_issue_as_not_planned_with_a_comment():
    uow, task_id, bus, hosts = _setup()
    assert run(CloseDiscardedIssue(uow.factory(), bus, hosts).execute(task_id, "Out of scope after the replan")) is True
    [close] = hosts.host.called("close_issue")
    assert (close["repository"], close["number"], close["reason"]) == (REPO, 12, "not_planned")
    assert "task US-1 was discarded" in close["comment"] and "Reason: Out of scope after the replan" in close["comment"]
    uow.rollback()
    link = uow.links.get_issue(task_id)
    assert link.state == "closed" and not link.broken
    assert [(w.number, w.action) for w in uow.own_writes.all()] == [(12, "issue_closed")]
    # The task itself isn't touched: closing never marks it as done.
    assert uow.tasks.get(task_id).status == "backlog"
    assert uow.proposals.list_by_project(link.project_id) == []
    [event] = bus.events
    assert (event.type, event.number, event.reason) == ("issue_closed", 12, "Out of scope after the replan")

    # Already closed: nothing else is sent.
    assert run(CloseDiscardedIssue(uow.factory(), bus, hosts).execute(task_id, "again")) is False
    assert len(hosts.host.called("close_issue")) == 1


def test_close_works_for_a_deleted_task_and_ignores_unpublished_ones():
    uow, task_id, bus, hosts = _setup()
    del uow.working["tasks"][task_id]  # the leader deleted the task (spec 003)
    uow.commit()
    assert run(CloseDiscardedIssue(uow.factory(), bus, hosts).execute(task_id, "Deleted")) is True
    assert "task #" in hosts.host.called("close_issue")[0]["comment"]

    uow, task_id, bus, hosts = _setup(published=False)
    assert run(CloseDiscardedIssue(uow.factory(), bus, hosts).execute(task_id, "Deleted")) is False
    assert hosts.host.calls == []


def test_close_of_an_issue_deleted_on_github_marks_it_broken():
    uow, task_id, bus, hosts = _setup()
    hosts.host.deleted_issues.add(12)
    assert run(CloseDiscardedIssue(uow.factory(), bus, hosts).execute(task_id, "Gone")) is True
    uow.rollback()
    assert uow.links.get_issue(task_id).broken is True and uow.own_writes.all() == []
    assert bus.events == []


# ---------- after_task_changed handler (spec 003 board use cases) ----------


def test_handler_syncs_on_edits_but_not_on_pure_moves():
    from app.domain.events import EventRef, TaskStatusChanged, TaskUpdated

    uow, task_id, bus, hosts = _setup()
    task = uow.tasks.get(task_id)
    ref = EventRef(kind="task", id=task_id)
    sync = SyncTaskIssue(uow.factory(), bus, hosts)

    moved = TaskStatusChanged(project_id=task.project_id, summary="moved", ref=ref, task_id=task_id, status="in_progress")
    run(sync.on_task_changed(task, moved))
    assert hosts.host.calls == [] and bus.events == []

    edited = TaskUpdated(project_id=task.project_id, summary="edited", ref=ref, task_id=task_id, fields=["title"])
    run(sync.on_task_changed(task, edited))
    [update] = hosts.host.called("update_issue")
    assert (update["number"], update["title"]) == (12, "Login (edited)")
    assert [e.type for e in bus.events] == ["issue_updated"]
