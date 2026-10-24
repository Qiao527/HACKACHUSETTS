# UI concept review and Kiro handoff

## Direction and scope

Reviewed against `DESIGN.md`, `skills/taste-skill/SKILL.md`, its complete app-screen chapter, and the React best-practices checklist. This is an app screen, not a marketing page: no photography, decorative animation, fake navigation or promotional statistics were added.

Style dealt: **Achromatic ledger**, seed **1557338506**, keeping supplied palette and type direction. A shell redraw was explored because an icon rail implied destinations this single-screen brief does not have; the implemented no-sidebar shell follows DESIGN.md's dark navigation frame and centered 1200px canvas. No referenced brand names, assets or proprietary fonts appear in the concept. Arial is an installed sans substitute; weight hierarchy stays light.

Screen question: **Which owner–tenant split remains positive under each roof schedule?**

Inventory: fictional East Boston warehouse; 1979 construction; unknown roof age; a 2–4-year life range; a selected year 3; a $300,000 synthetic roof budget; separately metered tenants; a 200 kW DC assumed array; a 25-year owner NPV; tenant first-full-year savings; a conditional mutual-benefit zone; unassessed structural capacity.

Idea: **The roof report's uncertainty sits beside the allocation tradeoff, so a positive number never hides missing evidence.** The live interaction selects an exported allocation point; every money value and chart coordinate comes from Python-generated JSON.

## Changes after the first browser review

1. Moved the tenant-share slider above the chart so it is visible on the first screen at 1440, 768 and 390px. Browser measurements verify its bottom is inside each viewport.
2. Replaced the shrunken desktop chart on phones with a compact chart, with legible ticks and three x labels. Both views use exported coordinates, one scale and the same data; only one is visible at a time.
3. Increased table data and chart legend text to 14px. The initial inspector warning about tiny text is gone.
4. Removed the implementation-facing “cent-safe bounds in JSON” phrase from user-facing range copy, and clarified that the tenant line is first-year savings.
5. Corrected the mobile chart's screen-reader description to say common dollar scale; the x-axis is a share percentage.

Kept the synthetic evidence badge, exact page-linked quotes, absent roof age, structural limitation, explicit different time bases and rounded-boundary caveat. Rounded labels do not define feasibility.

## Review rounds

ROUND 1

Seen in one second: two parties trade solar value while roof evidence qualifies the result.

Idea (one sentence): source uncertainty stays beside the allocation decision.

Live thing: schedule tabs and tenant-share slider select model-issued samples.

Layout words by section: shell=dark frame / allocation=two outcome columns and chart / evidence=cited report excerpts / details=two disclosures.

Scores: design 7 · usability 6 · creativity 6 · content 8 → overall 6.6.

Caps applied: no page-only imagery/motion caps; this is an app screen.

Top three problems, visible in `verification/ui-round1/`:
1. Desktop slider below the fold: moved it ahead of the chart.
2. Phone axis text shrunk with desktop viewBox: added a dedicated compact exported chart geometry.
3. Too much 12px data text: increased table and legend type.

ROUND 2

Seen in one second: the owner pays and the tenant saves; the slider is available immediately.

Idea (one sentence): a financial allocation and its source limitations share the same workspace.

Live thing: keyboard-operable allocation slider and roving-focus schedule tabs.

Layout words by section: shell=dark frame / allocation=results then action then chart / evidence=two exact quotations / details=assumptions and text table.

Scores: design 7.5 · usability 8 · creativity 6.5 · content 8.5 → overall 7.5.

Caps applied: creativity stays modest; this is a familiar analytical layout, not a novel interaction.

Remaining limitations: phone evidence and assumptions follow below the main chart; the whole brief cannot fit in the first phone viewport. A single dollar scale makes the one-year tenant line look smaller than the lifetime owner NPV, so the time-base note and separate numeric outcomes are essential. The static concept has no asynchronous data loading or failed-request states; its data is bundled at build time. No live confirmation/extraction flow is implied.

The last review changes only the incorrect screen-reader description; geometry stays the same. Final measurement reports and screenshots are in `verification/ui-final/`.

ROUND 3

Seen in one second: the same allocation workspace on the final webpack production build.

Idea (one sentence): financial benefits remain adjacent to unresolved source evidence.

Live thing: the exported-data slider, schedule tabs and accessible allocation table.

Layout words by section: unchanged from round 2.

Scores: design 7.5 · usability 8 · creativity 6.5 · content 8.5 → overall 7.5.

Caps applied: same app-screen limits as round 2. No new visual issue found in the six final screenshots. The corrected screen-reader description now matches the axes. Final lint and inspector both report 0 FAIL / 0 WARN; the final production build also passes all 21 allocation interaction checks.

## Accessibility and React checks

- Native range with a label, output, arrow-key support, descriptive help and live result status.
- ARIA tablist, selected states, roving tab stops, left/right/Home/End navigation, and an associated tab panel.
- Skip link, visible focus outlines, page language, semantic sections, chart descriptions and an expandable table with all 101 points.
- Distinct solid/dashed line styles supplement color. Missing roof age stays a missing fact; a real $0 prints as $0.00.
- 44px-or-larger range/tab hit targets, no page-level horizontal overflow at tested widths, and reduced-motion scroll behavior.
- Two small state variables; derived row selection during render; no effects, duplicated financial logic, API waterfalls, chart library or extra state abstraction. TypeScript production compilation checks the imported JSON shape.

Palette allowance: DESIGN.md explicitly requires #5266eb and lavender; `--allow palette` records that exception. This is the only inspector allowance. Dark header/footer, pale canvas, 12px rounded panels, flat surfaces and light type follow DESIGN.md.

## What the Kiro rebuild should take

Take the **layout**, **tokens** and **component choices** as a visual specification: adjacent evidence and results, side-by-side stakeholder figures, action before chart, quiet schedule tabs, page-linked quotations, compact phone chart, native controls and accessible text alternatives. The fictional PDF and expected-result JSON are reusable test data.

Rebuild the code. Do not reuse this client-only page, precomputed SVG geometry, copied JSON snapshot plumbing, fixed property wording or prototype Python engine as the real app. Wire the real contract, human confirmation and tested backend in Kiro. Replace all fictional property, roof, tenancy, price and production assumptions before any real assessment; verify eligibility and structural capacity separately.
