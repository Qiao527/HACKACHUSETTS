"""Golden tests: the engine must match the team reference model.

Cases and expected values come from data/fixtures/expected_engine_results.json
(reference model solaralign-reference-1.1). Money is compared at the fixture's
tolerance_usd; range edges at 1e-6.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.contract import EngineInput, Evidence, InputField
from src.engine import run_engine
from src.engine.compute import mutual_benefit_range

_FIXTURE = json.loads(
    (Path(__file__).resolve().parent.parent / "data" / "fixtures" / "expected_engine_results.json").read_text()
)
TOL = _FIXTURE["tolerance_usd"] + 1e-9
RANGE_TOL = 1e-6


def _field(name: str, value: float, unit: str) -> InputField:
    return InputField(
        field=name,
        value=float(value),
        unit=unit,
        status="confirmed",
        evidence=Evidence(document_id="reference", page=1, evidence_text="reference case", source_type="assumption"),
        confirmed_by_user=True,
    )


def to_engine_input(case_id: str, i: dict) -> EngineInput:
    """Map the reference model's inputs onto the contract (capex and O&M are per-size there)."""
    kw = i["system_kw_dc"]
    return EngineInput(
        scenario_id=case_id,
        roof_replacement_year=_field("roof_replacement_year", i["roof_replacement_year"], "years_from_today"),
        roof_replacement_cost=_field("roof_replacement_cost", i["roof_replacement_cost"], "USD"),
        removal_reinstall_cost=_field("removal_reinstall_cost", i["removal_reinstall_cost"], "USD"),
        annual_kwh=_field("annual_kwh", i["annual_kwh"], "kWh"),
        solar_capex=_field("solar_capex", kw * 1000 * i["capex_per_w_dc"], "USD"),
        om_cost_per_year=_field("om_cost_per_year", kw * i["om_per_kw_year"], "USD/year"),
        electricity_value_per_kwh=_field("electricity_value_per_kwh", i["electricity_value_per_kwh"], "USD/kWh"),
        downtime_fraction=i["downtime_fraction"],
        unallocated_share=i["unallocated_share"],
        tenant_share=i["tenant_share"],
        horizon_years=i["horizon_years"],
        discount_rate=i["discount_rate"],
        degradation=i["degradation"],
        escalation_rate=i["escalation_rate"],
    )


_PARAMS = [
    (case["id"], schedule, case["inputs"], expected)
    for case in _FIXTURE["cases"]
    for schedule, expected in case["expected"].items()
]


@pytest.mark.parametrize("case_id,schedule,inputs,expected", _PARAMS, ids=[f"{p[0]}-{p[1]}" for p in _PARAMS])
def test_matches_reference(case_id, schedule, inputs, expected):
    inp = to_engine_input(case_id, inputs)
    result = next(r for r in run_engine(inp).results if r.schedule == schedule)

    assert result.owner_npv == pytest.approx(expected["owner_npv"], abs=TOL)
    assert result.tenant_first_full_year_savings == pytest.approx(expected["tenant_first_full_year_savings"], abs=TOL)

    if expected["break_even_removal_cost"] is None:
        assert result.break_even_removal_cost is None
    else:
        assert result.break_even_removal_cost == pytest.approx(expected["break_even_removal_cost"], abs=TOL)

    got_range = mutual_benefit_range(inp, schedule)
    if expected["mutual_benefit_range"] is None:
        assert got_range is None
    else:
        assert got_range is not None
        assert got_range[0] == pytest.approx(expected["mutual_benefit_range"][0], abs=RANGE_TOL)
        assert got_range[1] == pytest.approx(expected["mutual_benefit_range"][1], abs=RANGE_TOL)


def test_contract_range_is_solar_now_remove_later():
    case = _FIXTURE["cases"][0]
    inp = to_engine_input(case["id"], case["inputs"])
    assert run_engine(inp).mutual_benefit_range == mutual_benefit_range(inp, "solar_now_remove_later")
