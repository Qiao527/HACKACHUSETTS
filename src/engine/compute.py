"""Orchestrate the engine: schedules -> yearly split -> metrics -> mutual-benefit range.

Matches the team reference model in data/fixtures/expected_engine_results.json
(tested in tests/test_engine_reference.py).

Owner incremental NPV for a schedule at tenant share s:
    NPV(s) = sum_t cash_t * df_t  -  baseline NPV  +  sum_t owner_cents_t(s)/100 * df_t
Tenant metric: tenant dollars in the first full operating year (not an NPV).
The two are never added together (financial rule 4).

Mutual-benefit range: tenant shares where owner NPV > 0 and tenant savings > 0.
- Lower edge: the smallest share at which tenant savings round to at least one
  cent in the first full year: 0.5 / allocatable_cents.
- Upper edge: the root of owner NPV, which is linear in s up to cent rounding:
  NPV(0) / (NPV(0) - NPV(1)).
None when empty; that is a valid answer (financial rule 5).
"""
from __future__ import annotations

from typing import Optional

from src.contract import EngineInput, EngineResult, Schedule, ScheduleResult, YearSplit
from src.engine.allocation import split_cents
from src.engine.schedules import (
    SCHEDULES,
    ScheduleModel,
    build_baseline,
    build_schedule,
    discount_factor,
    roof_year,
)

MODEL_VERSION = "engine-1.1.0 (matches solaralign-reference-1.1)"

_DEFAULT_SOURCES = [
    "data/fixtures/pvwatts.json",
    "assumption:electricity_value_per_kwh",
    "assumption:escalation_rate",
    "assumption:no_new_tenant_charges",
]


def _cash_npv(inp: EngineInput, model: ScheduleModel) -> float:
    return sum(amount * discount_factor(inp.discount_rate, t) for t, amount in model.cash.items())


def owner_npv(inp: EngineInput, schedule: Schedule, tenant_share: float) -> float:
    """Owner incremental NPV vs. the roof-only baseline, at the given tenant share."""
    model = build_schedule(inp, schedule)
    npv = _cash_npv(inp, model) - _cash_npv(inp, build_baseline(inp))
    for y in model.years:
        owner_c, _, _ = split_cents(y.total_cents, tenant_share, inp.unallocated_share)
        npv += owner_c / 100.0 * discount_factor(inp.discount_rate, y.year)
    return npv


def tenant_first_full_year_savings(inp: EngineInput, schedule: Schedule, tenant_share: float) -> float:
    first = build_schedule(inp, schedule).first_full_year
    if first is None:
        return 0.0
    _, tenant_c, _ = split_cents(first.total_cents, tenant_share, inp.unallocated_share)
    return tenant_c / 100.0


def mutual_benefit_range(inp: EngineInput, schedule: Schedule) -> Optional[tuple[float, float]]:
    """Exact range of tenant shares where both owner NPV and tenant savings are positive."""
    first = build_schedule(inp, schedule).first_full_year
    if first is None:
        return None
    _, _, unalloc_c = split_cents(first.total_cents, 0.0, inp.unallocated_share)
    allocatable_c = first.total_cents - unalloc_c
    if allocatable_c <= 0:
        return None
    lo = 0.5 / allocatable_c

    npv0 = owner_npv(inp, schedule, 0.0)
    if npv0 <= 0:
        return None
    npv1 = owner_npv(inp, schedule, 1.0)
    hi = min(1.0, npv0 / (npv0 - npv1)) if npv0 > npv1 else 1.0
    if hi <= lo:
        return None
    return (lo, hi)


def break_even_removal_cost(inp: EngineInput, schedule: Schedule) -> Optional[float]:
    """Removal/reinstall cost at which solar_now_remove_later's owner NPV is exactly 0.

    None when not applicable (other schedules, or no removal inside the horizon)
    or when the owner is negative even with free removal.
    """
    if schedule != "solar_now_remove_later":
        return None
    r = roof_year(inp)
    if not 1 <= r <= inp.horizon_years:
        return None
    npv = owner_npv(inp, schedule, inp.tenant_share)
    candidate = (inp.removal_reinstall_cost.value or 0.0) + npv / discount_factor(inp.discount_rate, r)
    if candidate < 0:
        return None
    return round(candidate, 2)


def _year_splits(inp: EngineInput, model: ScheduleModel) -> list[YearSplit]:
    out: list[YearSplit] = []
    for y in model.years:
        o, t, u = split_cents(y.total_cents, inp.tenant_share, inp.unallocated_share)
        out.append(
            YearSplit(
                year=y.year,
                kwh=y.kwh,
                total_value=y.total_cents / 100.0,
                unallocated_value=u / 100.0,
                owner_value=o / 100.0,
                tenant_value=t / 100.0,
            )
        )
    return out


def _schedule_result(inp: EngineInput, schedule: Schedule) -> ScheduleResult:
    return ScheduleResult(
        schedule=schedule,
        owner_npv=round(owner_npv(inp, schedule, inp.tenant_share), 2),
        tenant_first_full_year_savings=round(tenant_first_full_year_savings(inp, schedule, inp.tenant_share), 2),
        years=_year_splits(inp, build_schedule(inp, schedule)),
        break_even_removal_cost=break_even_removal_cost(inp, schedule),
        sources=list(_DEFAULT_SOURCES),
    )


def run_engine(inp: EngineInput) -> EngineResult:
    """Run all three schedules. Pure and deterministic.

    The contract has one `mutual_benefit_range`; it reports the range for
    solar_now_remove_later (the schedule the demo and brief center on).
    Per-schedule ranges are available from `mutual_benefit_range()`.
    """
    return EngineResult(
        scenario_id=inp.scenario_id,
        model_version=MODEL_VERSION,
        results=[_schedule_result(inp, s) for s in SCHEDULES],
        mutual_benefit_range=mutual_benefit_range(inp, "solar_now_remove_later"),
    )
