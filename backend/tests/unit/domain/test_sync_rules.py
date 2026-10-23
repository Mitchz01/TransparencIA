"""Spec 008, US1: the GitHub → board status rules (the table in the spec)."""

import pytest

from app.domain.sync import (
    IssueClosed,
    IssueReopened,
    PullRequestClosed,
    PullRequestMerged,
    PullRequestOpened,
    PullRequestReadyForReview,
    completes_checklist,
    next_status,
)

REPO = "acme/app"
OPENED = PullRequestOpened(repository=REPO, number=31, closes=[12])
READY = PullRequestReadyForReview(repository=REPO, number=31, closes=[12])
MERGED = PullRequestMerged(repository=REPO, number=31, closes=[12])
CLOSED_UNMERGED = PullRequestClosed(repository=REPO, number=31, closes=[12])
COMPLETED = IssueClosed(repository=REPO, number=12, reason="completed")
NOT_PLANNED = IssueClosed(repository=REPO, number=12, reason="not_planned")
REOPENED = IssueReopened(repository=REPO, number=12)


@pytest.mark.parametrize(
    ("current", "event", "expected"),
    [
        # The spec table
        ("todo", OPENED, "in_progress"),
        ("in_progress", READY, "review"),
        ("review", MERGED, "done"),
        ("in_progress", COMPLETED, "done"),
        ("in_progress", NOT_PLANNED, None),
        ("done", REOPENED, "todo"),
        # From earlier columns too
        ("backlog", OPENED, "in_progress"),
        ("todo", READY, "review"),
        ("todo", MERGED, "done"),
        ("backlog", COMPLETED, "done"),
        ("review", REOPENED, "todo"),
        ("in_progress", REOPENED, "todo"),
    ],
)
def test_spec_table(current, event, expected):
    assert next_status(current, event) == expected


@pytest.mark.parametrize("event", [OPENED, READY, MERGED, CLOSED_UNMERGED, COMPLETED, NOT_PLANNED])
def test_nothing_but_a_reopen_moves_a_task_out_of_done(event):
    assert next_status("done", event) is None


def test_progress_never_moves_a_task_back():
    assert next_status("review", OPENED) is None
    assert next_status("review", READY) is None


def test_reopening_a_task_not_started_leaves_it_where_it_is():
    assert next_status("todo", REOPENED) is None
    assert next_status("backlog", REOPENED) is None


def test_not_planned_and_unmerged_close_never_move_a_task():
    for current in ("backlog", "todo", "in_progress", "review"):
        assert next_status(current, NOT_PLANNED) is None
        assert next_status(current, CLOSED_UNMERGED) is None


def test_only_a_merge_completes_the_checklist():
    assert completes_checklist(MERGED)
    assert not any(completes_checklist(e) for e in (OPENED, READY, CLOSED_UNMERGED, COMPLETED, REOPENED))
