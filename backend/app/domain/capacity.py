"""The single capacity rule (spec 002, FR-010 and spec 003, FR-017): the sprint planner
fills iterations with it and the board warns about overload with it, so a freshly
generated plan never shows up as overloaded."""

from collections.abc import Iterable

from app.domain.project import Member

# Hours of work one story point takes, by seniority.
HOURS_PER_POINT = {"junior": 8, "mid": 6, "senior": 4}


def member_capacity(member: Member, sprint_weeks: int) -> int:
    """Points a member can take in one sprint, rounded down."""
    return member.hours_per_week * sprint_weeks // HOURS_PER_POINT[member.seniority]


def team_capacity(members: Iterable[Member], sprint_weeks: int) -> int:
    return sum(member_capacity(m, sprint_weeks) for m in members)
