# Implementation Tasks – ConnectHealth

Each stage ends with `npm test` and `npm run build` passing.

## Stage 1 – Project setup, Kiro artifacts, app shell
- [x] 1.1 Check environment (Node/npm/git); install native arm64 Node via Homebrew (x86 Node unusable). _R1_
- [x] 1.2 Write steering docs: product, design principles, synthetic data, clinical safety, tech. _R1–R11_
- [x] 1.3 Write spec: requirements, design, tasks. _R1–R11_
- [x] 1.4 Scaffold Vite + React + TS + Tailwind 4 + Vitest with pinned versions. _R1_
- [x] 1.5 Build layout: sidebar (7 items), top bar with period selector, synthetic banner, mobile menu. _R1.1–R1.4_
- [x] 1.6 Add Kiro hook to run tests when analysis/clinical source files are saved. _R11_

## Stage 2 – Data model and synthetic dataset
- [x] 2.1 Define models in `src/models/types.ts`. _R2.1–R2.5_
- [x] 2.2 Date helpers (`analysis/dates.ts`) with tests. _R2_
- [x] 2.3 Deterministic synthetic dataset generator (`data/syntheticDataset.ts`). _R2.6_
- [x] 2.4 Tests: determinism, coverage, intentional gaps present. _R2.6, R2.8_

## Stage 3 – Dashboard and timeline
- [x] 3.1 Cycle mapping (`analysis/cycle.ts`) with tests (recorded / estimated / projected). _R2.4, R4.5_
- [x] 3.2 Completeness + summary stats (`analysis/completeness.ts`). _R3.5_
- [x] 3.3 Overview page. _R3_
- [x] 3.4 Health Timeline with date filter, layer toggles, day inspector. _R4_

## Stage 4 – Data entry and persistence
- [x] 4.1 Reducer + context + storage with validation. _R5.3–R5.4_
- [x] 4.2 Validation functions with tests. _R5.2_
- [x] 4.3 Forms (seizure, observation, cycle, medication, medication event, history/symptom). _R5.1_
- [x] 4.4 Records page: tables, edit/delete, export/import/reset. _R5.1, R5.5_
- [x] 4.5 Tests: reducer recalculation, persistence round-trip. _R11_

## Stage 5 – Pattern-discovery engine
- [x] 5.1 Stats helpers (Fisher exact, exact binomial) with tests. _R6.2_
- [x] 5.2 Sleep, menstrual, medication, stress, trend modules. _R6.1–R6.7_
- [x] 5.3 Orchestrator + invariants tests (order, missing ≠ 0, events ≤ recorded, suppression). _R6.8, R11_
- [x] 5.4 Synthetic-dataset expected-output tests; document in `docs/DATASET.md`. _R2.6_
- [x] 5.5 Pattern Discovery page with InsightCard, thresholds, charts. _R8_

## Stage 6 – Clinical connections
- [x] 6.1 Knowledge base with verified citations. _R7.1_
- [x] 6.2 Connection rules + safety validators. _R7.2–R7.7_
- [x] 6.3 Tests: epilepsy alone ≠ ADHD, evidence required, no fabricated citations, unsafe language. _R11_
- [x] 6.4 Clinical Connections page (legend, cards, safety protocol, evidence library). _R7.4–R7.6_

## Stage 7 – Clinician summary and care tasks
- [x] 7.1 Summary generator + markdown export with tests. _R9_
- [x] 7.2 Clinician Summary page (copy / download / print). _R9.3_
- [x] 7.3 Care Tasks page + "Create follow-up task" from insight cards. _R8.3, R10_

## Stage 8 – End-to-end verification and polish
- [x] 8.1 UI smoke test (render, add record, persistence after remount). _R5.4_
- [x] 8.2 Manual run in browser via dev server (headless Chrome screenshots of every page). _R1_
- [x] 8.3 README, `docs/DATASET.md`, `docs/ANALYSIS_METHODS.md`, `docs/CITATIONS.md`, `docs/TESTING_CHECKLIST.md`.
