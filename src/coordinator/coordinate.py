"""Constrained proposal + owner/tenant explanations.

Guardrails (ai-rules.md, Coordinator):
1. Input is only the current EngineResult.
2. Proposes a range inside mutual_benefit_range; if None, proposes nothing.
3. Every number in the text must appear in the engine result (code checks).
4. scenario_id must match the engine result, else the output is stale/rejected.
7. Every proposal carries "not legal advice" and "eligibility not verified".
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional

from src.contract import CoordinatorOutput, EngineResult, Language

LLMCallable = Callable[[str, dict[str, Any]], dict[str, Any]]

REQUIRED_LABELS = ["not legal advice", "eligibility not verified"]

DEFAULT_TERMS = [
    "Roof condition, roof rights, structural review, and responsibility for roof and array work.",
    "Meter topology, account holders, and where on-site generation can offset load.",
    "Utility territory, rate class, interconnection, and credit-allocation restrictions.",
    "Project financing, lease duration, access, and any participation or consent requirements.",
    "How charges, operational responsibilities, and energy savings are treated.",
    "Current incentive, tax, permitting, and eligibility requirements.",
]

_NUMBER_RE = re.compile(r"-?\$?\d[\d,]*(?:\.\d+)?%?")


class CoordinatorRejected(ValueError):
    """Raised when the model's output fails a hard guardrail check."""


def _engine_number_strings(result: EngineResult) -> set[str]:
    """Every number the engine actually produced, as normalized strings.

    The coordinator may only use these. Numbers are compared on value, so the
    model may write 1234.5 or $1,234.50 as long as the underlying value matches
    an engine value (it copies, never re-rounds to a different value).
    """
    values: set[float] = set()

    def add(x: Optional[float]) -> None:
        if x is None:
            return
        values.add(round(float(x), 2))

    for sched in result.results:
        add(sched.owner_npv)
        add(sched.tenant_first_full_year_savings)
        add(sched.break_even_removal_cost)
        for y in sched.years:
            add(y.total_value)
            add(y.owner_value)
            add(y.tenant_value)
            add(y.unallocated_value)
            add(y.kwh)
            add(float(y.year))
    if result.mutual_benefit_range is not None:
        lo, hi = result.mutual_benefit_range
        add(lo)
        add(hi)
        # Shares are often shown as percentages.
        add(round(lo * 100, 2))
        add(round(hi * 100, 2))
    return {f"{v:.2f}" for v in values}


def _parse_number(token: str) -> Optional[float]:
    t = token.replace("$", "").replace(",", "").strip()
    pct = t.endswith("%")
    if pct:
        t = t[:-1]
    try:
        val = float(t)
    except ValueError:
        return None
    return val


def numbers_in_text(text: str) -> list[float]:
    """Extract numeric tokens from a block of explanation text."""
    out: list[float] = []
    for m in _NUMBER_RE.finditer(text or ""):
        val = _parse_number(m.group())
        if val is not None:
            out.append(val)
    return out


def _value_allowed(value: float, allowed: set[str]) -> bool:
    candidates = {f"{round(value, 2):.2f}", f"{round(value * 100, 2):.2f}"}
    # Allow the raw percentage form too (value already a percent of a share).
    if abs(value) <= 100:
        candidates.add(f"{round(value / 100, 2):.2f}")
    return bool(candidates & allowed)


def validate_output(output: CoordinatorOutput, result: EngineResult) -> CoordinatorOutput:
    """Reject the output if it breaks any hard guardrail; otherwise return it unchanged."""
    # Rule 4: scenario id must match the engine result.
    if output.scenario_id != result.scenario_id:
        raise CoordinatorRejected(
            f"scenario_id {output.scenario_id!r} does not match engine result {result.scenario_id!r} (stale)."
        )

    # Rule 2: proposed range must sit inside the engine's mutual-benefit range.
    if result.mutual_benefit_range is None:
        if output.proposed_range is not None:
            raise CoordinatorRejected("engine found no mutual-benefit range; coordinator must propose none.")
    elif output.proposed_range is not None:
        lo, hi = output.proposed_range
        elo, ehi = result.mutual_benefit_range
        if not (elo - 1e-9 <= lo <= hi <= ehi + 1e-9):
            raise CoordinatorRejected(
                f"proposed range {output.proposed_range} is outside engine range {result.mutual_benefit_range}."
            )

    # Rule 3: every number in the explanations must come from the engine result.
    allowed = _engine_number_strings(result)
    for label, text in (("owner", output.owner_explanation), ("tenant", output.tenant_explanation)):
        for value in numbers_in_text(text):
            if not _value_allowed(value, allowed):
                raise CoordinatorRejected(
                    f"{label} explanation contains number {value} that is not in the engine result."
                )

    # Rule 7: mandatory labels must be present.
    labels = {l.lower() for l in output.labels}
    for required in REQUIRED_LABELS:
        if required not in labels:
            raise CoordinatorRejected(f"missing required label: {required!r}")

    return output


def _build_prompt(result: EngineResult, language: Language) -> str:
    return (
        "You help a building team move a viable rooftop solar project forward. You are given ONLY "
        "the engine result below as JSON. You MUST NOT compute, interpolate, round differently, or "
        "invent any number. A dollar figure or percentage must already appear in the engine result.\n"
        f"Write plain-language explanations in language={language}. Use owner_explanation for the "
        "project/capital side and tenant_explanation for building electricity users. Frame both around "
        "broader solar adoption, practical alignment, and unresolved implementation facts—not maximizing "
        "landlord profit. Propose a value-share range strictly inside mutual_benefit_range, or none if it "
        "is null. Make clear that the range is not consent, a contract, or an eligibility finding. List "
        "roof, structural, meter, utility, financing, access, and participation terms to verify.\n"
        "Return JSON matching: {scenario_id, proposed_range:[lo,hi]|null, rationale, "
        "owner_explanation, tenant_explanation, language, terms_to_confirm:[...], "
        "labels:[\"not legal advice\",\"eligibility not verified\"]}.\n\n"
        f"ENGINE_RESULT = {result.model_dump_json()}"
    )


def coordinate(
    result: EngineResult,
    *,
    language: Language = "en",
    llm: Optional[LLMCallable] = None,
) -> CoordinatorOutput:
    """Produce a validated CoordinatorOutput for the given EngineResult.

    `llm` is injected so tests use recorded fixtures. The output is always run
    through validate_output, so an invented number or stale scenario is rejected.
    """
    if llm is None:
        from src.llm import call_llm as llm  # pragma: no cover - network path

    raw = llm(_build_prompt(result, language), {"type": "object"})
    if isinstance(raw, str):
        raw = json.loads(raw)

    pr = raw.get("proposed_range")
    proposed_range = tuple(pr) if isinstance(pr, (list, tuple)) and len(pr) == 2 else None

    output = CoordinatorOutput(
        scenario_id=str(raw.get("scenario_id", result.scenario_id)),
        proposed_range=proposed_range,
        rationale=str(raw.get("rationale", "")),
        owner_explanation=str(raw.get("owner_explanation", "")),
        tenant_explanation=str(raw.get("tenant_explanation", "")),
        language=raw.get("language", language),
        terms_to_confirm=list(raw.get("terms_to_confirm") or DEFAULT_TERMS),
        labels=list(raw.get("labels") or list(REQUIRED_LABELS)),
    )
    return validate_output(output, result)
