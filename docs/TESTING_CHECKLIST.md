# Testing checklist

`npm test` runs 131 Vitest tests across 9 files; `npm run build` type-checks and builds. The Kiro `PostFileSave`
hook runs the suite when engine, clinical, review, navigator, assistant, journal, sharing, onboarding, report,
summary, store or data files are saved.

## Automated

| Area | Test file |
|---|---|
| Counts, rates, denominators, missing ≠ 0, insufficient samples, cycle mapping, medication windows | `analysis/engine.test.ts`, `analysis/core.test.ts`, `analysis/syntheticExpected.test.ts` |
| Input-order invariance (findings, connections, summary); events ≤ recorded; recalculation after edit/delete | `analysis/engine.test.ts` |
| Evidence validation, no fabricated citations, unsafe-language guard, epilepsy alone ≠ ADHD | `clinical/clinical.test.ts` |
| Summary sections and current-data reflection | `summary/summary.test.ts` |
| v2 storage round-trip, v1 migration, corrupt data, import/export, demo vs user separation | `store/store.test.ts` |
| Onboarding validation, "no known conditions" exclusivity, symptom ≠ diagnosis, profile creation | `expansion.test.ts` |
| Symptom outcomes exclude unanswered days; outcomes only when data exist | `expansion.test.ts` |
| Flag rules (amber = prototype, red only for ≥ 5 min seizure), insufficient data not flagged, safe wording, report exclusion | `expansion.test.ts` |
| PDF is generated text (multi-page, title, patient, review section, disclaimer) | `expansion.test.ts` |
| Navigator suggestions, no necessity/coverage claims, plan-dependent referral notes, template placeholders | `expansion.test.ts` |
| Sharing off by default, revoke, restricted data absent (including derived insights and condition measures) | `expansion.test.ts` |
| Seizure log only with epilepsy; questions follow conditions; measure validation; yes/no measures as outcomes | `expansion.test.ts` |
| Bleeding yes/no builds, extends, trims and removes period records; journal bleeding proposals with undo; menstrual-only sharing | `expansion.test.ts` |
| Allergies: onboarding exclusivity, medication name match, report wording (not recorded ≠ none), sharing, assistant | `expansion.test.ts` |
| UI: allergies step in the journey; Overview allergies; medication warning; Allergies tab with duplicate check; dated cycle strip (period-start labels, hover detail, dated list) | `App.test.tsx` |
| UI: check-in asks “Menstrual bleeding on this day?” and creates the period record | `App.test.tsx` |
| UI: seizure logged inside the check-in (no duplicate check-in); non-epilepsy profile sees pain/BP/fatigue questions but no seizure log | `App.test.tsx` |
| Assistant grounding, unsupported questions, safety and emergency intents | `assistantJournal.test.ts` |
| Voice extraction (example, numbers, negation, no invented severity, medication matching), approve/undo | `assistantJournal.test.ts` |
| UI: welcome, demo, validation, persistence after remount, patterns → task, threshold + outcome switch, review → summary exclusion, delete | `App.test.tsx` |
| UI journey: onboarding → journal → ask → navigator task → report → share → preview → revoke → demo untouched | `App.test.tsx` |

## Manual (performed)

- [x] Headless Chrome screenshots: welcome, onboarding (500 px), demo overview, Clinician Review with markers, Care
      Navigator, Voice Journal (500 px).
- [x] Generated PDF opened and rendered (macOS `sips`) – title, disclaimer, chart with markers and legend, labelled items,
      page footer.

## Manual (not yet performed)

- [ ] Real microphone + speech recognition in Chrome/Edge/Safari, including permission denial.
- [ ] Download PDF and Print / Save as PDF from a real browser session; clipboard copy buttons.
- [ ] Keyboard-only and screen-reader pass; full WCAG validation needs assistive-technology testing and expert review.
- [ ] Phone hardware test of onboarding and voice journaling.
