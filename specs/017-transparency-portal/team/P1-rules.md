# P1 — Rules

You own **every number the citizen sees**: percentages, the traffic light, the weekly timeline and the
rule alerts. They're the credibility claim of the pitch ("the AI doesn't compute anything"), so they
must be right and tested. Plan tasks: T003–T006, T014.

## Your files (only these)

- `apps/api/app/domain/transparency.py` — the skeleton has the models and signatures from the
  [README](README.md#shared-interfaces); you write the bodies. Don't rename anything without telling P3.
- `apps/api/app/domain/board.py` — only `Task.done_at` and `reorder`.
- `apps/api/app/application/use_cases/transparency/confirm_expense.py`
- `apps/api/tests/unit/domain/test_transparency.py`
- `apps/api/tests/unit/application/test_confirm_expense.py`

Not yours: persistence (P3 adds the `done_at` column), endpoints (P3), agents (P2).

## Phase 1 (0:10–0:50): rules + tests

1. **`done_at`** in `domain/board.py`: `done_at: datetime | None = None` on `Task`. In `reorder`, the
   moved copy gets `done_at = now` when it enters `done` from another status, `None` when it leaves `done`,
   unchanged otherwise. Add a keyword argument `now: datetime | None = None` (defaults to UTC now) so
   tests fix it. Run `pytest tests/unit/domain/test_board_rules.py tests/unit/application/test_move_task.py`.
2. **Rules** in `domain/transparency.py`. `expenses` are always the confirmed ones; amounts `None` count 0.
   - `line_status`: spent per line, `available = amount - spent` (can go negative).
   - `summary`:
     - `spent_pct = spent / contract_value * 100`
     - `physical_pct = done points / all points * 100`, `None` when there are no points
     - `time_pct = days since start / days of the contract * 100`, clamped to 0–100
     - `unallocated = contract_value - sum(lines)`
     - Round percentages to 1 decimal.
   - `traffic_light` (FR-008), counting every alert, answered or not (D12):
     - red: any `high` alert, `spent_pct > 100`, or `spent_pct - physical_pct > 25`
     - yellow: any `medium` alert, `spent_pct - physical_pct > 10`, or `time_pct - physical_pct > 20`
     - green otherwise. With `physical_pct` `None`, skip the comparisons that use it.
     - One reason per trigger, in Spanish, with numbers. Examples:
       - "Se ha gastado 15 puntos más de lo que se ha avanzado"
       - "Hay 1 alerta de nivel medio en revisión"
       - "El tiempo transcurrido (46%) va 20 puntos por delante del avance (26%)"
     - Green gets one reason: "El gasto va acorde con el avance de las actividades".
   - `weekly_timeline`: one entry per week (Monday to Sunday), from the start date's week to the week of
     `min(today, end)`. Each week has:
     - `tasks_done`: tasks whose `done_at` falls in the week
     - `spent`: expenses whose `date` falls in the week
     - `spent_pct_acc` and `physical_pct_acc`: the totals accumulated up to that week
   - `sprint_progress`: done points and total points per sprint, in sprint order.
   - `rule_alerts(budget, end, confirmed, expense)`, where `confirmed` excludes `expense`:
     - `high`: the amount is greater than the line's `available`. "El gasto de $3.000.000 supera lo
       disponible en el rubro Plántulas de mangle ($2.000.000)".
     - `medium`: the date is before the start or after the end. "La fecha del gasto (2027-03-01) está
       fuera del periodo del contrato".
     - `low`: an amount with no budget line. "Gasto sin rubro asignado".
   - `budget_errors`:
     - `contract_value > 0`
     - each line `amount >= 0`, `name` 1–120 chars, ids unique
     - Field paths like `lines[1].amount`.
   - `confirmation_errors`:
     - `amount >= 0` or `None`
     - `budget_line_id` and `task_id` exist or are `None`
     - `citizen_summary` 1–200 chars
   - A helper `cop(n) -> "$1.850.000"` for the messages (dots as thousands separator).
3. **Tests** (`test_transparency.py`), each one small, with `today` fixed:
   - The spec's case: 40% spent and 25% physical is yellow, with the reason "15 puntos".
   - Each red trigger and each yellow trigger, one test each.
   - An answered alert still counts.
   - No tasks: `physical_pct` is `None` and the light doesn't crash.
   - Overspend above 100%.
   - Line overspend gives a `high` rule alert; a date outside the period gives a `medium` one.
   - The timeline: a week with tasks done and no spending; the accumulated values.
   - The demo numbers of the README: 32.4M spent and the medium alert give yellow.
4. Push as soon as the tests pass. **P3's `GetPortal` imports your functions: announce the commit.**

## Phase 2 (0:50–1:30): `ConfirmExpense`

`ConfirmExpense(uow, today).execute(project_id, expense_id, confirmation) -> Expense`:

1. Load the expense, or raise `ExpenseNotFound` (also when it belongs to another project).
2. If it isn't a draft, raise `ExpenseNotDraft`.
3. If the project has no budget, raise `BudgetMissing`.
4. Run `confirmation_errors`; if any fail, raise `ValidationFailed`.
5. Copy the confirmed fields and set `task_title` from the task.
6. Keep the AI alerts and add `rule_alerts` with `source="rule"`. Set `status="confirmed"`, then
   `uow.expenses.save` and `uow.commit()`.

Unit test it with an in-memory UoW: look at how `tests/unit/application/test_move_task.py` builds its
fakes and reuse that pattern. P3 wires it to the endpoint.

## Phase 3 (1:30–2:20)

Integration: check every number in the portal against the seed by hand (SC-003). Then help P3 with the
API tests.

## Done when

`pytest tests/unit` is green, and the demo project shows yellow with the right reasons.
