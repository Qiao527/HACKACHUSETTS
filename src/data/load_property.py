"""Load the demo building and the cached PVWatts result into an EngineInput.

Read once, on the server. Never by the browser, never by the LLM.

The demo building is Harbor Loom Warehouse, a FICTIONAL property described in
the synthetic document data/demo_documents/demo_pca.pdf. Roof facts are quoted
from that PDF (page + exact text). Cost and price inputs are the team's
canonical model defaults (data/fixtures/expected_engine_results.json, case
"canonical_defaults") and are labeled as assumptions.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.contract import EngineInput, Evidence, InputField

_ROOT = Path(__file__).resolve().parent.parent.parent
_PVWATTS = _ROOT / "data" / "fixtures" / "pvwatts.json"

DEMO_DOCUMENT = "demo_pca.pdf"

DEMO_PROPERTY: dict[str, Any] = {
    "name": "Harbor Loom Warehouse",
    "description": "A fictional low-rise, multi-tenant warehouse in East Boston.",
    "year_built": 1979,
    "source_document": DEMO_DOCUMENT,
    "source_type": "synthetic_document",
}

# Canonical model defaults (same as the reference model's canonical case).
SYSTEM_KW_DC = 200.0
CAPEX_PER_W_DC = 2.13
OM_PER_KW_YEAR = 21.0
ELECTRICITY_VALUE_PER_KWH = 0.2411


def load_pvwatts_annual_kwh(system_kw_dc: float = SYSTEM_KW_DC) -> float:
    """Annual AC kWh from the cached PVWatts V8 run, scaled to `system_kw_dc`.

    The fixture is a 500 kW DC run. PVWatts output is linear in system size for
    a fixed configuration, so scaling gives the same result as re-running it
    (200 kW -> 245,753 kWh, the reference model's value).
    """
    data = json.loads(_PVWATTS.read_text())
    fixture_kw = float(data["inputs"]["system_capacity"])
    return float(round(data["outputs"]["ac_annual"] * system_kw_dc / fixture_kw))


def _doc_field(field: str, value: float, unit: str, page: int, quote: str) -> InputField:
    return InputField(
        field=field,
        value=value,
        unit=unit,
        status="confirmed",
        evidence=Evidence(document_id=DEMO_DOCUMENT, page=page, evidence_text=quote, source_type="synthetic_document"),
        confirmed_by_user=True,
    )


def _assumption_field(field: str, value: float, unit: str, note: str) -> InputField:
    return InputField(
        field=field,
        value=value,
        unit=unit,
        status="confirmed",
        evidence=Evidence(document_id="assumptions", page=1, evidence_text=note, source_type="assumption"),
        confirmed_by_user=True,
    )


def build_demo_engine_input(
    *,
    tenant_share: float = 0.1,
    roof_replacement_year: float = 3.0,
    scenario_id: str = "harbor-loom-canonical",
) -> EngineInput:
    """Assemble a complete EngineInput for the demo building.

    Default tenant share 0.10 is the reference "comparison_10pct" case, which
    sits inside the mutual-benefit zone.
    """
    annual_kwh = load_pvwatts_annual_kwh()
    return EngineInput(
        scenario_id=scenario_id,
        roof_replacement_year=_doc_field(
            "roof_replacement_year",
            float(roof_replacement_year),
            "years_from_today",
            2,
            "Year 3 is the selected planning scenario within the 2-to-4-year range.",
        ),
        roof_replacement_cost=_doc_field(
            "roof_replacement_cost",
            300000.0,
            "USD (2024 real)",
            2,
            "Estimated roof replacement cost: $300,000 (2024 dollars).",
        ),
        removal_reinstall_cost=_doc_field(
            "removal_reinstall_cost",
            75000.0,
            "USD",
            2,
            "the separate model assumes $75,000 for panel removal and reinstallation",
        ),
        annual_kwh=InputField(
            field="annual_kwh",
            value=annual_kwh,
            unit="kWh",
            status="confirmed",
            evidence=Evidence(
                document_id="pvwatts.json",
                page=1,
                evidence_text=f"NREL PVWatts V8, Boston (lat 42.36, lon -71.06), scaled to {SYSTEM_KW_DC:.0f} kW DC.",
                source_type="api_fixture",
            ),
            confirmed_by_user=True,
        ),
        solar_capex=_assumption_field(
            "solar_capex",
            SYSTEM_KW_DC * 1000 * CAPEX_PER_W_DC,
            "USD",
            f"${CAPEX_PER_W_DC}/W DC x {SYSTEM_KW_DC:.0f} kW (DOE PV cost benchmark anchor, 2024 dollars).",
        ),
        om_cost_per_year=_assumption_field(
            "om_cost_per_year",
            SYSTEM_KW_DC * OM_PER_KW_YEAR,
            "USD/year",
            f"${OM_PER_KW_YEAR:.0f}/kW-year x {SYSTEM_KW_DC:.0f} kW operations and maintenance.",
        ),
        electricity_value_per_kwh=_assumption_field(
            "electricity_value_per_kwh",
            ELECTRICITY_VALUE_PER_KWH,
            "USD/kWh",
            "Assumed eligible electricity value; not a SMART or incentive rate.",
        ),
        downtime_fraction=0.05,
        unallocated_share=0.0,
        tenant_share=float(tenant_share),
        horizon_years=25,
        discount_rate=0.068,
        degradation=0.007,
        escalation_rate=0.0,
    )
