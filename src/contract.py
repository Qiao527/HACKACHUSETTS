"""Shared data contract for SolarAlign. FROZEN at 12:30.

Owner: backend owner. To change: ask the backend owner, post in the team chat,
log it in the Contract tab change log. Every module (engine, extract, coordinator, API, UI)
depends on these shapes.

Change log (approved by contract owner):
- Added InputField.text_value (Optional[str]) for non-numeric values such as
  ISO 8601 dates, text, and "true"/"false". Numeric values stay in `value`.
- Added EngineInput.escalation_rate (float >= 0, default 0.0): annual real
  escalation of electricity value.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["extracted_unconfirmed", "confirmed", "missing", "conflicting", "human_supplied"]
SourceType = Literal["synthetic_document", "public_record", "assumption", "api_fixture"]
Schedule = Literal["solar_now_remove_later", "roof_and_solar_now", "roof_then_solar"]
Language = Literal["en", "es", "zh"]


class Evidence(BaseModel):
    """Where a value came from."""
    document_id: str                      # e.g. "demo_pca.pdf"
    page: int = Field(ge=1)
    evidence_text: str                    # exact words on that page
    source_type: SourceType


class InputField(BaseModel):
    """Every input carries its evidence and status."""
    field: str                            # e.g. "roof_remaining_life_years"
    value: Optional[float] = None         # None when missing
    text_value: Optional[str] = None      # non-numeric: ISO 8601 date, text, "true"/"false"
    value_range: Optional[tuple[float, float]] = None  # keep ranges as ranges
    unit: str
    status: Status
    evidence: Optional[Evidence] = None
    confirmed_by_user: bool = False
    request: Optional[str] = None         # what to ask for when missing


class EngineInput(BaseModel):
    scenario_id: str
    roof_replacement_year: InputField     # years from today
    roof_replacement_cost: InputField     # USD
    removal_reinstall_cost: InputField    # USD
    annual_kwh: InputField                # from the PVWatts fixture
    solar_capex: InputField               # USD
    om_cost_per_year: InputField          # USD per year
    electricity_value_per_kwh: InputField # USD/kWh, labeled assumption
    downtime_fraction: float = Field(ge=0, le=1)   # share of that year's kWh lost during roof work
    unallocated_share: float = Field(ge=0, le=1)   # value that cannot be assigned
    tenant_share: float = Field(ge=0, le=1)        # the slider
    horizon_years: int = Field(ge=1)
    discount_rate: float = Field(ge=0)
    degradation: float = Field(ge=0, lt=1)
    escalation_rate: float = Field(default=0.0, ge=0)  # annual real escalation of electricity value


class YearSplit(BaseModel):
    """One year of electricity value, in dollars.

    Invariant: owner_value + tenant_value + unallocated_value == total_value.
    """
    year: int
    kwh: float
    total_value: float
    unallocated_value: float
    owner_value: float
    tenant_value: float


class ScheduleResult(BaseModel):
    schedule: Schedule
    owner_npv: float                      # incremental vs. roof-only baseline
    tenant_first_full_year_savings: float
    years: list[YearSplit]
    break_even_removal_cost: Optional[float] = None
    sources: list[str]                    # policy constant keys + assumption ids used


class EngineResult(BaseModel):
    scenario_id: str
    model_version: str
    results: list[ScheduleResult]
    mutual_benefit_range: Optional[tuple[float, float]] = None  # None = no zone; a valid answer
    notes: list[str] = ["Incentives (SMART, 48E) excluded; they may change the result.",
                        "Assumes no new tenant charges or rent increase."]


class CoordinatorOutput(BaseModel):
    """The AI reads EngineResult only and never computes numbers."""
    scenario_id: str                      # must match the EngineResult it read
    proposed_range: Optional[tuple[float, float]] = None  # must sit inside mutual_benefit_range
    rationale: str
    owner_explanation: str
    tenant_explanation: str
    language: Language
    terms_to_confirm: list[str]           # lease, meter, utility items
    labels: list[str] = ["not legal advice", "eligibility not verified"]
