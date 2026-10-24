---
inclusion: fileMatch
fileMatchPattern: ["src/engine/**/*.py", "tests/test_engine*.py"]
---

# Engine Rules (money math)

These apply whenever you write or change engine code or its tests. They exist because the obvious formulas are wrong.

## 1. One baseline, three schedules
Compare all schedules against ONE roof-only baseline (roof replaced at its planned year, no solar):
- `solar_now_remove_later`: install solar now; at roof replacement, pay removal/reinstall and lose `downtime_fraction` of that year's generation.
- `roof_and_solar_now`: replace the roof now (accelerated roof cost) and install solar now.
- `roof_then_solar`: replace the roof at its planned year, install solar then.
Owner NPV is incremental: NPV(schedule) − NPV(baseline). The roof replacement cost is never charged twice; schedules differ only in its timing.

## 2. Conservation, every year, to the cent
For each year: `owner_value + tenant_value + unallocated_value == total_value`.
`unallocated_value = unallocated_share × total_value`; `tenant_value = tenant_share × (total_value − unallocated_value)`; owner gets the rest. Validate `0 ≤ unallocated ≤ total`. Reconcile rounding in integer cents.
This identity is about yearly electricity dollars, not NPV.

## 3. Who bears which cost
The owner bears solar capex, O&M, removal/reinstall, and the roof-timing difference vs. baseline. P0 assumes no new tenant charges or rent increase; state this in outputs.

## 4. Two different metrics
Owner metric = incremental NPV over the horizon. Tenant metric = first-full-operating-year savings. Never add them together; label both.

## 5. Mutual-benefit range
The set of tenant shares where owner NPV > 0 AND tenant savings > 0. Find exact boundaries (solve, don't just grid). Return None when empty; that is a valid answer.

## 6. Properties that must hold (tested with Hypothesis)
- Conservation every year (rule 2).
- Tenant share 0 → tenant value 0.
- Raising tenant share never lowers tenant value and never raises owner value.
- Tenant share never changes kWh generated.
- Higher removal/reinstall cost never raises owner NPV for `solar_now_remove_later`.
- Zero generation → zero electricity value.
- Identical inputs → identical outputs.
- Endpoints of the mutual-benefit range satisfy both conditions.

## 7. Policy numbers
SMART, 48E and BERDO are excluded from P0 values. If ever added: SMART behind-the-meter > 25 kW AC = (base + adders − value of energy) × kWh, never base × kWh on top of savings; 48E is a status with reasons, never automatic value; BERDO uses the ACP, never daily penalties as savings.
