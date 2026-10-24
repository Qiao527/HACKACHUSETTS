---
inclusion: auto
name: policy-sources
description: Massachusetts and federal solar and building-emissions policy facts (SMART 3.0 rates, federal 48E tax credit timing, Boston BERDO emissions standards, ACP, penalties). Use when writing, checking, or explaining any incentive, tax credit, compliance, or policy number.
---

# Policy Sources

The single source of truth for policy numbers is:

#[[file:data/policy_constants.json]]

## How to use it
- Read values by key; never copy numbers into code.
- If a needed value is missing, add it to `policy_constants.json` with `value`, `unit`, `source_url`, `source_title`, and `retrieved` (YYYY-MM-DD). The `policy-source-guard` hook will reject entries without them.
- If two sources disagree, keep the official government source (mass.gov, boston.gov, irs.gov) and note the conflict in `notes`.

## Official references
- SMART 3.0 program details (rates, formulas, Value of Energy workbook): https://www.mass.gov/info-details/smart-30-program-details
- BERDO overview and compliance: https://www.boston.gov/departments/environment/building-emissions-reduction-and-disclosure
- BERDO emissions calculator (planning tool): https://berdocalculator.touchstoneiq.com/
- BERDO open data: https://data.boston.gov/dataset/building-emissions-reduction-and-disclosure-ordinance
- NREL PVWatts API: https://developer.nrel.gov/docs/solar/pvwatts/
