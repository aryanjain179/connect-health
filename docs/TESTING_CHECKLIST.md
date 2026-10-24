# Testing checklist

Run `npm test` (Vitest, 74 tests) and `npm run build` (type-check + production build). A Kiro hook
(`.kiro/hooks/run-tests-on-engine-save.json`) runs the suite when engine, clinical, summary, store or data files
are saved.

## Automated

| Requirement | Test file(s) |
|---|---|
| Seizure counts and rates | `analysis/syntheticExpected.test.ts`, `analysis/engine.test.ts` (sleep analysis) |
| Observation-day denominators | `engine.test.ts` (no-check-in exclusion, menstrual eligible days), `syntheticExpected.test.ts` |
| Missing sleep data ≠ 0 h | `engine.test.ts` › "excludes missing sleep rather than counting it as 0 hours" |
| Missing attention ≠ "no" | `clinical/clinical.test.ts` › "missing attention fields are not counted" |
| Incomplete menstrual records | `analysis/core.test.ts` (single record, implausible cycle), `engine.test.ts` (one bounded cycle, no records) |
| Medication changes in window | `engine.test.ts` › medication-change analysis (in / out of window, short follow-up) |
| Insufficient sample sizes | `engine.test.ts` (sleep group too small, too few seizure days, trend < 60 days), melatonin suppression |
| Recalculation after edit / delete | `engine.test.ts` › "recalculates after editing and deleting records"; `App.test.tsx` (add, delete via UI) |
| Persistence after refresh | `store/store.test.ts` (round-trip, corrupt data), `App.test.tsx` (remount keeps new seizure) |
| Evidence requirements | `clinical.test.ts` (all KB entries valid, unknown evidence suppressed, diagnosis-only signal rejected) |
| No fabricated citations | `clinical.test.ts` (PMID allow-list, PubMed URL must contain PMID, non-allow-listed host rejected) |
| No unsupported diagnoses / unsafe language | `clinical.test.ts` (validator unit tests + all generated text for 3 datasets × 2 periods; no cancer terms) |
| Epilepsy alone ≠ ADHD suggestion | `clinical.test.ts` |
| Input-order invariance | `engine.test.ts` (findings, connections and summary identical after shuffling every collection) |
| Events never exceed recorded events | `engine.test.ts` › "event counts in any group never exceed recorded events" |
| Determinism of synthetic data | `engine.test.ts`, `syntheticExpected.test.ts` |
| Input validation | `store.test.ts`, `App.test.tsx` (future date rejected in the form) |
| Insight → task workflow | `App.test.tsx` |
| Threshold change recalculates | `App.test.tsx` |

## Manual (performed in Chrome during development)

- [x] Overview, Timeline, Pattern Discovery, Clinical Connections, Clinician Summary, Care Tasks and Records render
      with data from the store (headless Chrome screenshots at 1440 px and 500 px widths).
- [x] Sleep chart shows gaps for missing nights; cycle strip shows hatched (estimated) and faded (projected) phases.
- [ ] Copy-to-clipboard, Download .md and Print in a real browser session (clipboard needs a user gesture; not
      automatable in headless screenshots).
- [ ] Keyboard-only pass (Tab through sidebar, dialogs close with Esc) and screen-reader spot check. Full WCAG
      conformance needs manual testing with assistive technologies and expert review.
- [ ] Import a previously exported JSON file and confirm counts.
