"""Spec 017's rules: every number and the traffic light the portal shows (FR-005, FR-007–FR-009)."""

import datetime as dt

from app.domain.board import Sprint, Task, reorder
from app.domain.transparency import (
    Alert,
    Budget,
    BudgetLine,
    Expense,
    ExpenseConfirmation,
    budget_errors,
    confirmation_errors,
    cop,
    end_date,
    line_status,
    rule_alerts,
    sprint_progress,
    summary,
    traffic_light,
    weekly_timeline,
)

START = dt.date(2026, 8, 3)  # a Monday, as in the demo
END = end_date(Budget(project_id=1, contracting_entity="x", contractor="x", contract_value=1, start_date=START), 26)
TODAY = dt.date(2026, 10, 23)


def _budget(**overrides) -> Budget:
    data = {
        "project_id": 1,
        "contracting_entity": "Corpamag",
        "contractor": "Fundación Manglares Vivos",
        "contract_value": 180_000_000,
        "start_date": START,
        "lines": [
            BudgetLine(id="R1", name="Plántulas de mangle", amount=45_000_000),
            BudgetLine(id="R2", name="Mano de obra local", amount=70_000_000),
            BudgetLine(id="R3", name="Logística y transporte fluvial", amount=30_000_000),
            BudgetLine(id="R4", name="Monitoreo y talleres comunitarios", amount=35_000_000),
        ],
    }
    return Budget(**{**data, **overrides})


def _expense(amount: int | None, line: str | None = "R1", date: dt.date | None = dt.date(2026, 8, 20), alerts=(), **fields) -> Expense:
    return Expense(
        project_id=1, file_id=1, mime="application/pdf", kind="invoice", status="confirmed",
        amount=amount, date=date, budget_line_id=line, alerts=list(alerts), **fields,
    )


def _alert(level: str, answer: str | None = None) -> Alert:
    return Alert(level=level, reason="…", source="ai", answer=answer)


def _task(id: int, points: int, done_on: dt.date | None = None, sprint_id: int | None = None) -> Task:
    done_at = dt.datetime.combine(done_on, dt.time(15), dt.timezone.utc) if done_on else None
    return Task(
        id=id, project_id=1, key=f"T-{id}", title=f"Tarea {id}", points=points, sprint_id=sprint_id,
        status="done" if done_on else "todo", done_at=done_at,
    )


# ---------- Traffic light (FR-008) ----------


def test_the_specs_case_is_yellow_with_the_gap_in_points():
    light, reasons = traffic_light(40.0, 25.0, 30.0, [])

    assert light == "yellow"
    assert reasons == ["Se ha gastado 15 puntos más de lo que se ha avanzado"]


def test_green_when_spending_follows_progress():
    assert traffic_light(30.0, 28.0, 30.0, []) == ("green", ["El gasto va acorde con el avance de las actividades"])


def test_red_when_there_is_a_high_alert():
    light, reasons = traffic_light(10.0, 10.0, 10.0, [_alert("high")])

    assert light == "red"
    assert reasons == ["Hay 1 alerta de nivel alto en revisión"]


def test_red_when_spending_exceeds_the_contract():
    light, reasons = traffic_light(104.0, 100.0, 100.0, [])

    assert light == "red"
    assert reasons == ["El gasto (104%) supera el valor del contrato"]


def test_red_when_spending_runs_more_than_25_points_ahead():
    light, reasons = traffic_light(55.5, 30.0, 40.0, [])

    assert light == "red"
    assert reasons == ["Se ha gastado 25,5 puntos más de lo que se ha avanzado"]


def test_exactly_10_or_25_points_ahead_doesnt_change_the_color():
    assert traffic_light(35.0, 25.0, 30.0, [])[0] == "green"
    assert traffic_light(50.0, 25.0, 30.0, [])[0] == "yellow"


def test_yellow_when_there_is_a_medium_alert():
    light, reasons = traffic_light(10.0, 10.0, 10.0, [_alert("medium"), _alert("medium")])

    assert light == "yellow"
    assert reasons == ["Hay 2 alertas de nivel medio en revisión"]


def test_yellow_when_time_runs_more_than_20_points_ahead_of_progress():
    light, reasons = traffic_light(20.0, 20.0, 46.2, [])

    assert light == "yellow"
    assert reasons == ["El tiempo transcurrido (46,2%) va 26,2 puntos por delante del avance (20%)"]


def test_low_alerts_dont_change_the_color():
    assert traffic_light(10.0, 10.0, 10.0, [_alert("low")])[0] == "green"


def test_an_answered_alert_still_counts():
    assert traffic_light(10.0, 10.0, 10.0, [_alert("high", answer="Se reclasificó el gasto.")])[0] == "red"


def test_red_lists_every_trigger_worst_first():
    _, reasons = traffic_light(60.0, 20.0, 50.0, [_alert("medium"), _alert("high")])

    assert reasons == [
        "Hay 1 alerta de nivel alto en revisión",
        "Se ha gastado 40 puntos más de lo que se ha avanzado",
        "El tiempo transcurrido (50%) va 30 puntos por delante del avance (20%)",
        "Hay 1 alerta de nivel medio en revisión",
    ]


def test_without_planned_work_only_alerts_and_overspend_count():
    assert traffic_light(90.0, None, 90.0, []) == ("green", ["El gasto va acorde con el avance de las actividades"])
    assert traffic_light(101.0, None, 90.0, [])[0] == "red"


# ---------- Summary and budget lines (FR-007) ----------


def test_the_demo_project_is_yellow_because_of_the_restaurant_alert():
    expenses = [
        _expense(30_000_000, "R1", dt.date(2026, 8, 20)),
        _expense(None, "R2", dt.date(2026, 9, 15)),  # the field photo
        _expense(2_400_000, "R1", dt.date(2026, 10, 2), alerts=[_alert("medium")]),
    ]
    tasks = [_task(1, 10, dt.date(2026, 8, 14)), _task(2, 20, dt.date(2026, 9, 18)), _task(3, 70)]

    result = summary(_budget(), END, expenses, tasks, TODAY)

    assert (result.spent, result.spent_pct, result.physical_pct) == (32_400_000, 18.0, 30.0)
    assert result.time_pct == 44.8  # 81 of 181 days
    assert result.unallocated == 0
    assert (result.light, result.reasons) == ("yellow", ["Hay 1 alerta de nivel medio en revisión"])


def test_the_spec_case_through_the_summary():
    tasks = [_task(1, 1, dt.date(2026, 9, 1)), _task(2, 3)]  # 25% done

    result = summary(_budget(), END, [_expense(72_000_000)], tasks, dt.date(2026, 9, 7))

    assert (result.spent_pct, result.physical_pct, result.light) == (40.0, 25.0, "yellow")
    assert result.reasons[0] == "Se ha gastado 15 puntos más de lo que se ha avanzado"


def test_a_project_without_tasks_has_no_physical_progress():
    result = summary(_budget(), END, [_expense(1_000_000)], [], TODAY)

    assert result.physical_pct is None
    assert result.light == "green"


def test_overspending_the_contract_shows_over_100_percent_and_red():
    result = summary(_budget(), END, [_expense(150_000_000, "R2"), _expense(50_000_000, "R3")], [_task(1, 1, TODAY)], TODAY)

    assert result.spent_pct == 111.1
    assert result.light == "red"


def test_unallocated_is_the_contract_minus_the_lines():
    assert summary(_budget(contract_value=200_000_000), END, [], [], TODAY).unallocated == 20_000_000


def test_time_elapsed_is_clamped_to_the_contract():
    assert summary(_budget(), END, [], [], dt.date(2026, 7, 1)).time_pct == 0.0
    assert summary(_budget(), END, [], [], dt.date(2027, 5, 1)).time_pct == 100.0


def test_line_status_goes_negative_when_a_line_is_overspent():
    lines = line_status(_budget(), [_expense(40_000_000, "R1"), _expense(8_000_000, "R1"), _expense(5_000_000, "R3"), _expense(9, None)])

    assert [(line.id, line.spent, line.available) for line in lines] == [
        ("R1", 48_000_000, -3_000_000),
        ("R2", 0, 70_000_000),
        ("R3", 5_000_000, 25_000_000),
        ("R4", 0, 35_000_000),
    ]


# ---------- Weekly timeline (FR-009) ----------


def test_one_week_per_monday_up_to_today():
    weeks = weekly_timeline(_budget(), END, [], [], dt.date(2026, 8, 19))

    assert [w.week_start for w in weeks] == [dt.date(2026, 8, 3), dt.date(2026, 8, 10), dt.date(2026, 8, 17)]


def test_a_week_with_work_done_and_no_spending():
    tasks = [_task(1, 2, dt.date(2026, 8, 12)), _task(2, 2)]

    week1, week2 = weekly_timeline(_budget(), END, [], tasks, dt.date(2026, 8, 12))

    assert (week1.tasks_done, week1.spent, week1.physical_pct_acc) == ([], 0, 0.0)
    assert ([t.title for t in week2.tasks_done], week2.spent, week2.physical_pct_acc) == (["Tarea 1"], 0, 50.0)


def test_spending_and_progress_accumulate():
    expenses = [_expense(18_000_000, date=dt.date(2026, 8, 4)), _expense(9_000_000, date=dt.date(2026, 8, 16)), _expense(9_000_000, date=dt.date(2026, 8, 11))]
    tasks = [_task(1, 1, dt.date(2026, 8, 5)), _task(2, 1, dt.date(2026, 8, 13)), _task(3, 2)]

    week1, week2 = weekly_timeline(_budget(), END, expenses, tasks, dt.date(2026, 8, 16))

    assert (week1.spent, week1.spent_pct_acc, week1.physical_pct_acc) == (18_000_000, 10.0, 25.0)
    assert (week2.spent, week2.spent_pct_acc, week2.physical_pct_acc) == (18_000_000, 20.0, 50.0)


def test_spending_outside_the_span_lands_in_the_first_or_last_week():
    expenses = [_expense(1, date=dt.date(2026, 7, 1)), _expense(10, date=dt.date(2027, 1, 1))]

    weeks = weekly_timeline(_budget(), END, expenses, [], dt.date(2026, 8, 12))

    assert [w.spent for w in weeks] == [1, 10]


def test_the_timeline_ends_at_the_contracts_end():
    weeks = weekly_timeline(_budget(), END, [], [], dt.date(2027, 6, 1))

    assert len(weeks) == 26
    assert weeks[-1].week_start == dt.date(2027, 1, 25)


def test_no_weeks_before_the_start():
    assert weekly_timeline(_budget(), END, [], [], dt.date(2026, 7, 31)) == []


# ---------- Sprints ----------


def test_sprint_progress_in_sprint_order():
    sprints = [Sprint(id=8, project_id=1, number=2, name="Vivero", goal="g2"), Sprint(id=7, project_id=1, number=1, name="Diagnóstico", goal="g1")]
    tasks = [_task(1, 3, TODAY, sprint_id=7), _task(2, 2, sprint_id=7), _task(3, 5, sprint_id=8)]

    assert [(s.name, s.done_points, s.total_points) for s in sprint_progress(sprints, tasks)] == [("Diagnóstico", 3, 5), ("Vivero", 0, 5)]


# ---------- Rule alerts (FR-005) ----------


def test_an_amount_above_whats_left_in_the_line_is_a_high_alert():
    budget = _budget(lines=[BudgetLine(id="R1", name="Plántulas de mangle", amount=5_000_000)])

    [alert] = rule_alerts(budget, END, [_expense(3_000_000)], _expense(3_000_000))

    assert alert.level == "high"
    assert alert.reason == "El gasto de $3.000.000 supera lo disponible en el rubro Plántulas de mangle ($2.000.000)"


def test_spending_exactly_whats_left_is_fine():
    budget = _budget(lines=[BudgetLine(id="R1", name="Plántulas", amount=5_000_000)])

    assert rule_alerts(budget, END, [_expense(3_000_000)], _expense(2_000_000)) == []


def test_a_date_outside_the_contract_is_a_medium_alert():
    [alert] = rule_alerts(_budget(), END, [], _expense(1_000, date=dt.date(2027, 3, 1)))

    assert alert.level == "medium"
    assert alert.reason == "La fecha del gasto (2027-03-01) está fuera del periodo del contrato (2026-08-03 a 2027-01-31)"


def test_an_amount_without_a_line_is_a_low_alert():
    assert [(a.level, a.reason) for a in rule_alerts(_budget(), END, [], _expense(1_000, line=None))] == [("low", "Gasto sin rubro asignado")]


def test_a_photo_has_no_rule_alerts():
    assert rule_alerts(_budget(), END, [], _expense(None, line=None)) == []


# ---------- Validation ----------


def test_a_valid_budget_has_no_errors():
    assert budget_errors(_budget()) == []


def test_budget_errors_point_at_each_field():
    budget = _budget(
        contractor=" ",
        contract_value=0,
        lines=[BudgetLine(id="R1", name="Plántulas", amount=-1), BudgetLine(id="R1", name="", amount=5)],
    )

    assert [e.field for e in budget_errors(budget)] == ["contractor", "contract_value", "lines[0].amount", "lines[1].id", "lines[1].name"]


def test_confirmation_errors():
    confirmation = ExpenseConfirmation(
        kind="invoice", amount=-5, date=None, supplier=None, concept=None, budget_line_id="R9", task_id=99, citizen_summary=""
    )

    assert [e.field for e in confirmation_errors(confirmation, _budget(), {1, 2})] == ["amount", "budget_line_id", "task_id", "citizen_summary"]


def test_cop_formats_pesos():
    assert (cop(1_850_000), cop(0), cop(-2_000)) == ("$1.850.000", "$0", "-$2.000")


# ---------- done_at (D5) ----------


def test_entering_done_stamps_done_at_and_leaving_clears_it():
    now = dt.datetime(2026, 9, 1, 12, tzinfo=dt.timezone.utc)
    tasks = [Task(id=1, project_id=1, key="T-1", title="t", status="review")]

    [done] = reorder(tasks, 1, "done", None, None, now=now)
    other = Task(id=2, project_id=1, key="T-2", title="u", status="done", position=1)
    moved = reorder([done, other], 1, "done", 1, None, now=now + dt.timedelta(days=3))
    moved_within = next(t for t in moved if t.id == 1)
    [reopened] = reorder([done], 1, "in_progress", None, None, now=now)

    assert done.done_at == now
    assert moved_within.done_at == now  # reordering inside "done" keeps the original date
    assert reopened.done_at is None
