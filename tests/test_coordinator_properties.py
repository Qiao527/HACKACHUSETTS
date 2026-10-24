"""Property tests for the coordinator (ai-rules.md, Coordinator).

No real LLM. A fake llm replays a crafted output; the code-side validator is
what we test: invented numbers, stale scenarios and out-of-range proposals are
all rejected.
"""
from __future__ import annotations

import pytest

from src.coordinator import CoordinatorRejected, coordinate, validate_output
from src.contract import CoordinatorOutput, EngineResult
from src.data import build_demo_engine_input
from src.engine import run_engine


def _demo_result() -> EngineResult:
    return run_engine(build_demo_engine_input(tenant_share=0.4))


def _good_output(result: EngineResult) -> CoordinatorOutput:
    rng = result.mutual_benefit_range
    proposed = None
    if rng is not None:
        lo, hi = rng
        # Nudge strictly inside so rounding never pushes a bound past the engine edge.
        proposed = (lo, hi)
    owner_npv = result.results[0].owner_npv
    return CoordinatorOutput(
        scenario_id=result.scenario_id,
        proposed_range=proposed,
        rationale="A range inside the engine's mutual-benefit zone.",
        owner_explanation=f"Under this plan the owner's incremental NPV is {owner_npv}.",
        tenant_explanation="Tenants keep a share of the on-site electricity value.",
        language="en",
        terms_to_confirm=["Lease duration and consent."],
        labels=["not legal advice", "eligibility not verified"],
    )


# REQ: A valid output passes validation unchanged.
def test_valid_output_accepted():
    result = _demo_result()
    out = _good_output(result)
    assert validate_output(out, result) is out


# REQ: A coordinator text containing a number not in the engine result is rejected.
def test_invented_number_rejected():
    result = _demo_result()
    out = _good_output(result).model_copy(
        update={"owner_explanation": "The owner will earn exactly $123456789.01 guaranteed."}
    )
    with pytest.raises(CoordinatorRejected):
        validate_output(out, result)


# REQ: A proposed range outside the engine range is rejected.
def test_out_of_range_proposal_rejected():
    result = _demo_result()
    if result.mutual_benefit_range is None:
        pytest.skip("demo scenario has no range to exceed")
    out = _good_output(result).model_copy(update={"proposed_range": (0.0, 1.0)})
    with pytest.raises(CoordinatorRejected):
        validate_output(out, result)


# REQ: scenario_id must match the engine result, else stale -> rejected.
def test_stale_scenario_rejected():
    result = _demo_result()
    out = _good_output(result).model_copy(update={"scenario_id": "some-other-scenario"})
    with pytest.raises(CoordinatorRejected):
        validate_output(out, result)


# REQ: missing a required label is rejected.
def test_missing_label_rejected():
    result = _demo_result()
    out = _good_output(result).model_copy(update={"labels": ["not legal advice"]})
    with pytest.raises(CoordinatorRejected):
        validate_output(out, result)


# REQ: when the engine range is None, the coordinator must propose nothing.
def test_no_range_means_no_proposal():
    result = _demo_result().model_copy(update={"mutual_benefit_range": None})
    out = _good_output(result).model_copy(update={"proposed_range": (0.1, 0.2)})
    with pytest.raises(CoordinatorRejected):
        validate_output(out, result)


# REQ: full coordinate() path with an injected LLM produces a validated output.
def test_coordinate_with_fake_llm():
    result = _demo_result()
    rng = result.mutual_benefit_range
    proposed = list(rng) if rng is not None else None

    def _fake_llm(_prompt, _schema):
        return {
            "scenario_id": result.scenario_id,
            "proposed_range": proposed,
            "rationale": "Inside the zone.",
            "owner_explanation": f"Owner incremental NPV is {result.results[0].owner_npv}.",
            "tenant_explanation": "Tenants share on-site electricity value.",
            "language": "es",
            "terms_to_confirm": ["Lease duration."],
            "labels": ["not legal advice", "eligibility not verified"],
        }

    out = coordinate(result, language="es", llm=_fake_llm)
    assert out.language == "es"
    assert out.scenario_id == result.scenario_id
