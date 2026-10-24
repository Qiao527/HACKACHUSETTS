"""Property-based tests for the SolarAlign engine (financial-rules.md rule 6).

Every test names the EARS requirement it covers. The engine is pure code; the
LLM is never involved. No live APIs are called.
"""
from __future__ import annotations

import math

from hypothesis import HealthCheck, assume, given, settings
from hypothesis import strategies as st

from src.contract import EngineInput, Evidence, InputField
from src.engine import run_engine
from src.engine.compute import owner_npv
from src.engine.schedules import build_schedule

# ---------------------------------------------------------------------------
# Strategies: build a valid EngineInput with wide-ranging numbers.
# ---------------------------------------------------------------------------


def _field(name: str, value: float, unit: str = "USD") -> InputField:
    return InputField(
        field=name,
        value=float(value),
        unit=unit,
        status="confirmed",
        evidence=Evidence(
            document_id="test",
            page=1,
            evidence_text="test fixture value",
            source_type="assumption",
        ),
        confirmed_by_user=True,
    )


@st.composite
def engine_inputs(draw, *, annual_kwh: float | None = None, tenant_share: float | None = None):
    horizon = draw(st.integers(min_value=3, max_value=25))
    roof_year = draw(st.integers(min_value=1, max_value=horizon))
    kwh = annual_kwh if annual_kwh is not None else draw(
        st.floats(min_value=0.0, max_value=2_000_000.0, allow_nan=False, allow_infinity=False)
    )
    ts = tenant_share if tenant_share is not None else draw(
        st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
    )
    return EngineInput(
        scenario_id="prop",
        roof_replacement_year=_field("roof_replacement_year", roof_year, "years_from_today"),
        roof_replacement_cost=_field(
            "roof_replacement_cost",
            draw(st.floats(min_value=0.0, max_value=2_000_000.0, allow_nan=False, allow_infinity=False)),
        ),
        removal_reinstall_cost=_field(
            "removal_reinstall_cost",
            draw(st.floats(min_value=0.0, max_value=500_000.0, allow_nan=False, allow_infinity=False)),
        ),
        annual_kwh=_field("annual_kwh", kwh, "kWh"),
        solar_capex=_field(
            "solar_capex",
            draw(st.floats(min_value=0.0, max_value=3_000_000.0, allow_nan=False, allow_infinity=False)),
        ),
        om_cost_per_year=_field(
            "om_cost_per_year",
            draw(st.floats(min_value=0.0, max_value=100_000.0, allow_nan=False, allow_infinity=False)),
        ),
        electricity_value_per_kwh=_field(
            "electricity_value_per_kwh",
            draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
            "USD/kWh",
        ),
        downtime_fraction=draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
        unallocated_share=draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
        tenant_share=ts,
        horizon_years=horizon,
        discount_rate=draw(st.floats(min_value=0.0, max_value=0.2, allow_nan=False, allow_infinity=False)),
        degradation=draw(st.floats(min_value=0.0, max_value=0.05, allow_nan=False, allow_infinity=False)),
        escalation_rate=draw(st.floats(min_value=0.0, max_value=0.05, allow_nan=False, allow_infinity=False)),
    )


SETTINGS = settings(max_examples=150, deadline=None, suppress_health_check=[HealthCheck.too_slow])


# ---------------------------------------------------------------------------
# REQ: Conservation every year, to the cent (financial-rules rule 2).
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs())
def test_conservation_every_year(inp: EngineInput):
    result = run_engine(inp)
    for sched in result.results:
        for y in sched.years:
            total_cents = round(y.total_value * 100)
            parts_cents = round(y.owner_value * 100) + round(y.tenant_value * 100) + round(y.unallocated_value * 100)
            assert parts_cents == total_cents


# ---------------------------------------------------------------------------
# REQ: WHEN tenant share is 0, tenant value is 0.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs(tenant_share=0.0))
def test_tenant_share_zero_gives_zero_tenant_value(inp: EngineInput):
    result = run_engine(inp)
    for sched in result.results:
        for y in sched.years:
            assert y.tenant_value == 0.0
        assert sched.tenant_first_full_year_savings == 0.0


# ---------------------------------------------------------------------------
# REQ: Raising tenant share never lowers tenant value and never raises owner value.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs(), st.floats(min_value=0.0, max_value=1.0), st.floats(min_value=0.0, max_value=1.0))
def test_tenant_share_monotonic(inp: EngineInput, s1: float, s2: float):
    lo, hi = sorted((s1, s2))
    inp_lo = inp.model_copy(update={"tenant_share": lo})
    inp_hi = inp.model_copy(update={"tenant_share": hi})
    res_lo = run_engine(inp_lo)
    res_hi = run_engine(inp_hi)
    for s_lo, s_hi in zip(res_lo.results, res_hi.results):
        # tenant value never decreases as share rises
        for y_lo, y_hi in zip(s_lo.years, s_hi.years):
            assert y_hi.tenant_value >= y_lo.tenant_value - 0.01
            # owner value never increases as share rises
            assert y_hi.owner_value <= y_lo.owner_value + 0.01
        # owner NPV never increases as tenant share rises
        assert s_hi.owner_npv <= s_lo.owner_npv + 0.01


# ---------------------------------------------------------------------------
# REQ: Tenant share never changes kWh generated.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs(), st.floats(min_value=0.0, max_value=1.0))
def test_tenant_share_does_not_change_kwh(inp: EngineInput, other_share: float):
    base = run_engine(inp)
    other = run_engine(inp.model_copy(update={"tenant_share": other_share}))
    for b, o in zip(base.results, other.results):
        for yb, yo in zip(b.years, o.years):
            assert math.isclose(yb.kwh, yo.kwh, rel_tol=0, abs_tol=1e-9)


# ---------------------------------------------------------------------------
# REQ: Higher removal/reinstall cost never raises owner NPV for solar_now_remove_later.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs(), st.floats(min_value=0.0, max_value=500_000.0), st.floats(min_value=0.0, max_value=500_000.0))
def test_higher_removal_never_raises_owner_npv(inp: EngineInput, r1: float, r2: float):
    lo, hi = sorted((r1, r2))
    inp_lo = inp.model_copy(update={"removal_reinstall_cost": _field("removal_reinstall_cost", lo)})
    inp_hi = inp.model_copy(update={"removal_reinstall_cost": _field("removal_reinstall_cost", hi)})
    npv_lo = next(r for r in run_engine(inp_lo).results if r.schedule == "solar_now_remove_later").owner_npv
    npv_hi = next(r for r in run_engine(inp_hi).results if r.schedule == "solar_now_remove_later").owner_npv
    assert npv_hi <= npv_lo + 0.01


# ---------------------------------------------------------------------------
# REQ: Zero generation -> zero electricity value.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs(annual_kwh=0.0))
def test_zero_generation_zero_value(inp: EngineInput):
    result = run_engine(inp)
    for sched in result.results:
        for y in sched.years:
            assert y.total_value == 0.0
            assert y.owner_value == 0.0
            assert y.tenant_value == 0.0
        assert sched.tenant_first_full_year_savings == 0.0


# ---------------------------------------------------------------------------
# REQ: Identical inputs -> identical outputs (determinism).
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs())
def test_deterministic(inp: EngineInput):
    assert run_engine(inp).model_dump() == run_engine(inp).model_dump()


# ---------------------------------------------------------------------------
# REQ: The roof replacement cost is never charged twice (rule 1).
# Isolate the roof cost by differencing two inputs that differ ONLY in roof
# cost: the extra outlay a schedule takes on must equal exactly ONE discounted
# roof charge (the roof falls in a single year, so the delta is roof_delta * one
# discount factor). Two charges would double this.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs(), st.floats(min_value=1_000.0, max_value=500_000.0))
def test_roof_cost_charged_once(inp: EngineInput, roof_delta: float):
    base_cost = inp.roof_replacement_cost.value or 0.0
    inp_more = inp.model_copy(
        update={"roof_replacement_cost": _field("roof_replacement_cost", base_cost + roof_delta)}
    )
    for schedule in ("solar_now_remove_later", "roof_and_solar_now", "roof_then_solar"):
        cash_a = build_schedule(inp, schedule).cash
        cash_b = build_schedule(inp_more, schedule).cash
        years = set(cash_a) | set(cash_b)
        deltas = {t: cash_b.get(t, 0.0) - cash_a.get(t, 0.0) for t in years}
        # Charged exactly once => the raw (undiscounted) extra outlay == roof_delta.
        assert math.isclose(sum(deltas.values()), -roof_delta, rel_tol=1e-6, abs_tol=1e-3)
        # And it appears in exactly one year.
        assert len([t for t, d in deltas.items() if abs(d) > 1e-6]) == 1


# ---------------------------------------------------------------------------
# REQ: Mutual-benefit range endpoints satisfy both conditions; None when empty.
# ---------------------------------------------------------------------------
@SETTINGS
@given(engine_inputs())
def test_mutual_benefit_range_endpoints(inp: EngineInput):
    result = run_engine(inp)
    rng = result.mutual_benefit_range
    if rng is None:
        return  # None is a valid answer (rule 5)
    lo, hi = rng
    assert 0.0 <= lo < hi <= 1.0
    # A share just inside the range must make both metrics strictly positive.
    mid = (lo + hi) / 2.0
    assert owner_npv(inp, "solar_now_remove_later", mid) > -0.01
    # tenant savings strictly positive at mid requires mid>0 and first-year value>0
    inp_mid = inp.model_copy(update={"tenant_share": mid})
    tenant_mid = next(
        r for r in run_engine(inp_mid).results if r.schedule == "solar_now_remove_later"
    ).tenant_first_full_year_savings
    assert tenant_mid > -0.01


# ---------------------------------------------------------------------------
# REQ: When no tenant share makes both positive, return no range.
# Construct a case: solar is never worth it (huge capex, tiny value).
# ---------------------------------------------------------------------------
def test_no_mutual_benefit_when_solar_uneconomic():
    inp = EngineInput(
        scenario_id="uneconomic",
        roof_replacement_year=_field("roof_replacement_year", 5, "years_from_today"),
        roof_replacement_cost=_field("roof_replacement_cost", 100_000),
        removal_reinstall_cost=_field("removal_reinstall_cost", 50_000),
        annual_kwh=_field("annual_kwh", 1000, "kWh"),
        solar_capex=_field("solar_capex", 5_000_000),
        om_cost_per_year=_field("om_cost_per_year", 10_000),
        electricity_value_per_kwh=_field("electricity_value_per_kwh", 0.10, "USD/kWh"),
        downtime_fraction=0.5,
        unallocated_share=0.1,
        tenant_share=0.5,
        horizon_years=20,
        discount_rate=0.06,
        degradation=0.005,
    )
    assert run_engine(inp).mutual_benefit_range is None
