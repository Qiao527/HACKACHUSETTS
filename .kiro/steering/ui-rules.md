---
inclusion: fileMatch
fileMatchPattern: ["app/**/*.tsx", "app/**/*.ts", "app/**/*.css"]
---

# UI Rules

Visual style: #[[file:DESIGN.md]]

- Use DESIGN.md for color, type, spacing and component feel. It is a style reference only: never use the referenced brand's name, logo, wordmark or assets.
- The UI never calculates money. It calls `/api/engine` and displays the result. Slider changes re-call the engine (fast, no LLM); the AI proposal refreshes only when the user asks.
- Main chart: x = tenant share 0–100%; two separately labeled lines (owner NPV, tenant first-year savings); mutual-benefit zone shaded and labeled; a clear message when no zone exists.
- Owner and tenant always appear side by side.
- Every synthetic input shows a "synthetic" badge; every assumption shows an "assumption" label; every proposal shows "not legal advice" and "eligibility not verified".
- Evidence panel: each extracted value shows its page number and quote; click to expand; confirm/edit controls.
- Accessibility: keyboard-operable slider and controls, visible focus, text alternative for the chart, color is never the only signal.
- Language toggle (en/es) switches the explanations, not the numbers.
