---
inclusion: always
---

# Product: SolarAlign

## One-liner
SolarAlign shows why financially promising rooftop solar stalls on older multi-tenant buildings, by revealing who pays, who benefits, and how roof timing changes the deal, with every input traced to evidence.

## The problem
The owner controls and pays for the roof and the panels. Tenants often pay the electricity bills and may capture the savings (the split incentive). A project that is positive for the building as a whole can be negative for the owner and never get built. Roof replacement timing is the supporting variable: if the roof must be replaced soon, panels are removed and reinstalled, which shrinks the value available to share.

## Users
- Primary: owner or asset manager of an older, low-rise, multi-tenant commercial building in Boston, reviewing a solar proposal before committing capital.
- Second stakeholder: tenants. Tenants appear in every result, explanation, and brief.

## The question we answer
"Is there an allocation of solar value that benefits both owner and tenants, does roof timing preserve it, and what must be confirmed to execute it?"

## Architecture (locked)
AI extracts evidence -> deterministic engine models the trade-offs -> AI coordinator proposes and explains within engine results -> humans decide.

1. Evidence: an LLM extracts roof facts from a synthetic roof report PDF; every value has a page number and an exact quote; humans confirm or edit.
2. Engine (Python): three roof/solar schedules vs. one roof-only baseline; yearly owner/tenant/unallocated split; owner incremental NPV; tenant first-full-year savings; mutual-benefit range of tenant share.
3. AI coordinator: reads only the engine result, proposes a range inside the engine's mutual-benefit range, writes an owner explanation and a tenant explanation (English and Spanish), and lists lease, meter and utility terms to confirm.
4. Brief: one printable page with both stakeholder outcomes, evidence, assumptions, and next actions.

## Non-negotiable principles
- Only the engine computes money. The LLM never computes, interpolates, or invents numbers; it copies engine numbers unchanged.
- Every number shows its source or an "assumption" label. Policy numbers come only from `data/policy_constants.json`.
- No mutual-benefit zone is a valid answer. Allocation redistributes value; it cannot create value.
- Flag, don't decide: no structural, legal, or eligibility approvals. Every proposal is labeled "not legal advice" and "eligibility not verified".
- Real vs. synthetic is always labeled. The demo building's public facts come from Boston Assessing; roof report, tenancy and meters are synthetic.
- SMART, 48E and BERDO are not added to the numbers; they are shown as "may change the result".

## Scope today
One building, one roof report, two controls (tenant share slider, roof timing), one engine, one coordinator, one brief. Out of scope: maps, address search, portfolios, chatbot, incentive or eligibility engines, structural approval.
