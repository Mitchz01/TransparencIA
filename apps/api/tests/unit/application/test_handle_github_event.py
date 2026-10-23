"""Spec 008, US1: HandleGithubEvent applies GitHub progress to the board without a proposal."""

import asyncio

from app.application.use_cases.integrations.handle_github_event import HandleGithubEvent
from app.domain.board import ChecklistItem, Sprint, Task
from app.domain.integrations import ExternalLink, OwnWrite
from app.domain.sync import (
    IssueClosed,
    IssueReopened,
    PullRequestClosed,
    PullRequestMerged,
    PullRequestOpened,
    PullRequestReadyForReview,
)
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run
REPO = "acme/app"


class Board:
    """A connected project with a sprint, tasks US-1..US-3 and issues #12, #13 for US-1 and US-2."""

    def __init__(self):
        self.uow = InMemoryUnitOfWork()
        self.project = self.uow.projects.add(project(repository=REPO, status="ready"))
        pid = self.project.id
        sprint = self.uow.sprints.add(Sprint(project_id=pid, number=1, name="Sprint 1", goal="Login"))
        self.tasks = {}
        for i, key in enumerate(("US-1", "US-2", "US-3")):
            checklist = [ChecklistItem(text="Form"), ChecklistItem(text="Tests", done=True)]
            task = self.uow.tasks.add(
                Task(project_id=pid, sprint_id=sprint.id, key=key, title=key, status="todo", position=i, checklist=checklist)
            )
            self.tasks[key] = task.id
        for key, number in (("US-1", 12), ("US-2", 13)):
            self.uow.links.add(
                ExternalLink(project_id=pid, task_id=self.tasks[key], kind="issue", repository=REPO, number=number, url=f"u{number}")
            )
        self.uow.commit()
        self.bus = RecordingEventBus()
        self.changed = []
        self.reviews = []

        async def after_task_changed(task, event):
            self.changed.append((task.key, event.type))

        async def on_opened(event):
            self.reviews.append(event.number)

        self.use_case = HandleGithubEvent(self.uow.factory(), self.bus, [after_task_changed], on_opened)

    def task(self, key: str) -> Task:
        with self.uow:
            return self.uow.tasks.get(self.tasks[key])

    def status(self, key: str) -> str:
        return self.task(key).status

    def set_status(self, key: str, status: str) -> None:
        with self.uow:
            self.uow.tasks.save(self.uow.tasks.get(self.tasks[key]).model_copy(update={"status": status}))
            self.uow.commit()

    def links(self, kind: str) -> list[ExternalLink]:
        with self.uow:
            return self.uow.links.list_by_project(self.project.id, kind)

    def handle(self, event, delivery: str = "d-1"):
        return run(self.use_case.handle(delivery, "pull_request", event))


def test_pr_merged_moves_to_done_and_completes_the_checklist():
    board = Board()
    board.set_status("US-1", "review")
    board.handle(PullRequestMerged(repository=REPO, number=31, closes=[12]))

    task = board.task("US-1")
    assert task.status == "done"
    assert all(item.done for item in task.checklist)
    assert [(e.type, e.actor) for e in board.bus.events] == [("task_updated", "github"), ("task_status_changed", "github")]
    assert board.bus.events[1].summary == "US-1 moved to done (PR #31 merged on GitHub)"
    assert board.changed == [("US-1", "task_updated"), ("US-1", "task_status_changed")]
    [pr] = board.links("pull_request")
    assert (pr.task_id, pr.number, pr.state) == (board.tasks["US-1"], 31, "merged")


def test_pr_closing_two_issues_moves_both_and_links_the_pr():
    board = Board()
    receipt = board.handle(PullRequestOpened(repository=REPO, number=31, closes=[12, 13], author="ana"))

    assert receipt.status == "accepted"
    assert (board.status("US-1"), board.status("US-2"), board.status("US-3")) == ("in_progress", "in_progress", "todo")
    assert [e.task_id for e in board.bus.of_type("task_status_changed")] == [board.tasks["US-1"], board.tasks["US-2"]]
    assert sorted(link.task_id for link in board.links("pull_request")) == [board.tasks["US-1"], board.tasks["US-2"]]
    assert board.reviews == [31]  # spec 007's ProposeReview gets the opened PR


def test_ready_for_review_finds_the_tasks_through_the_pr_link():
    board = Board()
    board.handle(PullRequestOpened(repository=REPO, number=31, closes=[12]), delivery="d-1")
    # The body was edited and lost "Closes #12": the PR link still says which task it is
    board.handle(PullRequestReadyForReview(repository=REPO, number=31, closes=[]), delivery="d-2")
    assert board.status("US-1") == "review"
    assert board.reviews == [31]


def test_same_delivery_twice_is_applied_once():
    board = Board()
    first = board.handle(PullRequestOpened(repository=REPO, number=31, closes=[12]), delivery="d-9")
    board.set_status("US-1", "todo")  # if it ran again, it would move it again
    second = board.handle(PullRequestOpened(repository=REPO, number=31, closes=[12]), delivery="d-9")

    assert (first.status, second.status, second.reason) == ("accepted", "ignored", "duplicate")
    assert board.status("US-1") == "todo"
    assert len(board.bus.of_type("task_status_changed")) == 1
    with board.uow:
        assert [d.delivery_id for d in board.uow.deliveries.all()] == ["d-9"]


def test_unknown_repo_unlinked_issue_and_unhandled_events_are_ignored():
    board = Board()
    unknown = board.handle(IssueClosed(repository="acme/other", number=12), delivery="d-1")
    unhandled = run(board.use_case.handle("d-2", "push", None))
    unlinked = board.handle(IssueClosed(repository=REPO, number=99), delivery="d-3")

    assert (unknown.status, unknown.reason) == ("ignored", "unknown_repository")
    assert (unhandled.status, unhandled.reason) == ("ignored", "unhandled_event")
    assert unlinked.status == "accepted"
    assert board.bus.events == [] and board.changed == []
    assert [board.status(k) for k in ("US-1", "US-2", "US-3")] == ["todo", "todo", "todo"]


def test_the_echo_of_our_own_close_is_ignored_and_consumed():
    board = Board()
    board.set_status("US-1", "in_progress")
    with board.uow:
        board.uow.own_writes.add(OwnWrite(repository=REPO, number=12, action="issue_closed"))
        board.uow.commit()

    board.handle(IssueClosed(repository=REPO, number=12, reason="completed"), delivery="d-1")
    assert board.status("US-1") == "in_progress" and board.bus.events == []
    with board.uow:
        assert board.uow.own_writes.all()[0].consumed_at is not None

    # Consumed: a later close by someone on GitHub is progress again
    board.handle(IssueClosed(repository=REPO, number=12, reason="completed"), delivery="d-2")
    assert board.status("US-1") == "done"


def test_issue_closed_and_reopened_update_the_task_and_the_link():
    board = Board()
    board.handle(IssueClosed(repository=REPO, number=12, reason="completed"), delivery="d-1")
    assert board.status("US-1") == "done"
    assert board.links("issue")[0].state == "closed"

    board.handle(IssueReopened(repository=REPO, number=12), delivery="d-2")
    assert board.status("US-1") == "todo"
    assert board.links("issue")[0].state == "open"


def test_not_planned_doesnt_move_the_task_and_tells_the_leader():
    board = Board()
    board.set_status("US-1", "in_progress")
    board.handle(IssueClosed(repository=REPO, number=12, reason="not_planned"))

    assert board.status("US-1") == "in_progress"
    [event] = board.bus.events
    assert (event.type, event.task_id, event.number, event.reason) == (
        "github_event_ignored",
        board.tasks["US-1"],
        12,
        "closed_not_planned",
    )
    assert board.changed == []


def test_github_never_moves_a_done_task_except_reopen():
    board = Board()
    board.set_status("US-1", "done")
    board.handle(PullRequestOpened(repository=REPO, number=31, closes=[12]))
    assert board.status("US-1") == "done"
    assert board.bus.of_type("task_status_changed") == []


def test_a_pr_closed_without_merge_only_closes_its_link():
    board = Board()
    board.handle(PullRequestOpened(repository=REPO, number=31, closes=[12]), delivery="d-1")
    board.handle(PullRequestClosed(repository=REPO, number=31, closes=[12]), delivery="d-2")
    assert board.status("US-1") == "in_progress"
    assert [link.state for link in board.links("pull_request")] == ["closed"]


def test_a_failing_review_proposal_doesnt_undo_the_sync():
    board = Board()

    async def broken(event):
        raise RuntimeError("agent down")

    use_case = HandleGithubEvent(board.uow.factory(), board.bus, [], broken)
    run(use_case.handle("d-1", "pull_request", PullRequestOpened(repository=REPO, number=31, closes=[12])))
    assert board.status("US-1") == "in_progress"
