---
inclusion: always
---

# Design & Engineering Principles

## Interface

- Clean clinical interface: restrained slate/teal palette, one accent colour, status colours used sparingly
  (amber = needs review, rose = safety only).
- Readable typography (system UI stack, 14–16px body), generous spacing, cards with clear headings.
- Every chart has a title, axis labels/units and a legend or caption that explains missing or estimated data.
- Responsive: sidebar collapses to a top bar on small screens; grids fall back to one column.
- Accessibility: semantic landmarks, labelled form fields, visible focus rings, colour is never the only signal
  (estimated phases use pattern + label, missing data uses text + icon), buttons have accessible names.
- Every visible control must do something meaningful. No placeholder buttons.

## Code organisation

- Keep layers separate:
  - `src/models` – TypeScript types only.
  - `src/data` – synthetic dataset generator.
  - `src/analysis` – pure, deterministic pattern-discovery functions (no React, no Date.now()).
  - `src/clinical` – knowledge base, connection rules, safety validators.
  - `src/summary` – clinician summary generator.
  - `src/store` – reducer, persistence and React context.
  - `src/components`, `src/pages` – UI only; never compute clinical statistics inline.
- Dates are ISO `YYYY-MM-DD` strings handled with UTC-based helpers in `src/analysis/dates.ts`.
- Analysis output must be independent of input order (sort/group internally).
- Prefer small pure functions with unit tests (Vitest). Run `npm test` and `npm run build` after each stage.
- Pin dependency versions exactly.
