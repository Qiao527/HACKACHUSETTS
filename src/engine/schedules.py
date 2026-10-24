"""The three roof/solar schedules and one roof-only baseline.

Financial rule 1 (one baseline, three schedules):

Baseline (roof-only): replace the roof at its planned year R, no solar.

solar_now_remove_later: install solar in year 0; pay the roof at R; at R (when
    1 <= R <= horizon) also pay removal/reinstall and lose `downtime_fraction`
    of that year's generation.
roof_and_solar_now:     replace the roof in year 0 (accelerated) and install solar in year 0.
roof_then_solar:        replace the roof at R and install solar at R.

Timing conventions (match data/fixtures/expected_engine_results.json):
- Year 0 is today and is not discounted. Cash in year t is discounted by (1+r)^-t.
- A system installed in year i generates in years i+1 .. horizon. Degradation
  uses the operating-year index (first operating year = 0).
- Electricity value escalates as (1 + escalation_rate)^(t-1).
- Anything that would fall after the horizon is outside the model and is not charged.

Owner NPV is incremental: NPV(schedule) - NPV(baseline). The roof replacement
cost is charged at most once in each schedule and in the baseline; schedules
differ only in *when* it falls, so it never double-counts.

Everything here is deterministic: identical inputs -> identical outputs.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from src.contract import EngineInput, Schedule

SCHEDULES: tuple[Schedule, ...] = (
    "solar_now_remove_later",
    "roof_and_solar_now",
    "roof_then_solar",
)


def round_half_up(x: float) -> int:
    """Round to the nearest integer, halves away from zero (not banker's rounding)."""
    return int(Decimal(repr(x)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def discount_factor(rate: float, year: int) -> float:
    """Discount a year-`year` amount to today. Year 0 is today."""
    return (1.0 + rate) ** -year


@dataclass(frozen=True)
class OperatingYear:
    """One modeled year (1..horizon), before owner/tenant allocation."""

    year: int
    kwh: float
    total_cents: int          # electricity value that year, integer cents
    downtime: bool = False    # True in the removal/reinstall year


@dataclass(frozen=True)
class ScheduleModel:
    """Everything the metrics need for one schedule (or the baseline)."""

    schedule: str
    install_year: Optional[int]                 # None when no solar is modeled
    cash: dict[int, float] = field(default_factory=dict)  # owner non-electricity cash by year
    years: tuple[OperatingYear, ...] = ()        # years 1..horizon

    @property
    def first_full_year(self) -> Optional[OperatingYear]:
        """First operating year with generation that is not a downtime year."""
        if self.install_year is None:
            return None
        for y in self.years:
            if y.year > self.install_year and not y.downtime:
                return y
        return None


def roof_year(inp: EngineInput) -> int:
    """Planned roof replacement year (years from today), clamped to >= 0."""
    val = inp.roof_replacement_year.value
    return max(0, round_half_up(val)) if val is not None else 0


def _v(f) -> float:
    return f.value or 0.0


def build_baseline(inp: EngineInput) -> ScheduleModel:
    cash: dict[int, float] = {}
    r = roof_year(inp)
    if r <= inp.horizon_years:
        cash[r] = -_v(inp.roof_replacement_cost)
    years = tuple(OperatingYear(year=t, kwh=0.0, total_cents=0) for t in range(1, inp.horizon_years + 1))
    return ScheduleModel(schedule="baseline", install_year=None, cash=cash, years=years)


def build_schedule(inp: EngineInput, schedule: Schedule) -> ScheduleModel:
    horizon = inp.horizon_years
    r = roof_year(inp)
    capex = _v(inp.solar_capex)
    om = _v(inp.om_cost_per_year)
    roof_cost = _v(inp.roof_replacement_cost)
    removal = _v(inp.removal_reinstall_cost)
    base_kwh = _v(inp.annual_kwh)
    price = _v(inp.electricity_value_per_kwh)

    cash: dict[int, float] = {}

    def add(t: int, amount: float) -> None:
        if 0 <= t <= horizon:
            cash[t] = cash.get(t, 0.0) + amount

    removal_year: Optional[int] = None
    if schedule == "solar_now_remove_later":
        install = 0
        add(0, -capex)
        add(r, -roof_cost)
        if 1 <= r <= horizon:
            removal_year = r
            add(r, -removal)
    elif schedule == "roof_and_solar_now":
        install = 0
        add(0, -capex)
        add(0, -roof_cost)
    elif schedule == "roof_then_solar":
        install = r
        add(r, -capex)
        add(r, -roof_cost)
    else:  # pragma: no cover - guarded by Literal
        raise ValueError(f"unknown schedule {schedule!r}")

    installed = install <= horizon
    years: list[OperatingYear] = []
    for t in range(1, horizon + 1):
        producing = installed and t > install
        if not producing:
            years.append(OperatingYear(year=t, kwh=0.0, total_cents=0))
            continue
        add(t, -om)
        kwh = base_kwh * (1.0 - inp.degradation) ** (t - install - 1)
        downtime = t == removal_year
        if downtime:
            kwh *= 1.0 - inp.downtime_fraction
        value = kwh * price * (1.0 + inp.escalation_rate) ** (t - 1)
        years.append(OperatingYear(year=t, kwh=kwh, total_cents=round_half_up(value * 100), downtime=downtime))

    return ScheduleModel(
        schedule=schedule,
        install_year=install if installed else None,
        cash=cash,
        years=tuple(years),
    )
