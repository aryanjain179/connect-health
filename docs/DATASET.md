# Synthetic dataset

All records are **fictional**. "Maya R." is not a real person and no record was derived from a real patient.
Generator: `src/data/syntheticDataset.ts` (`createSyntheticDataset()`), deterministic (fixed dates, seeded
mulberry32 PRNG, seed `20260723`). Re-generating always produces identical records (asserted in tests).

## Design

| Item | Value |
|---|---|
| Period | 2026-07-23 → 2026-10-20 (90 days) |
| Patient | 29-year-old female, focal epilepsy (confirmed, 2019), migraine without aura (confirmed) |
| Daily check-ins | 83 of 90 days. No check-in: 08-19, 08-20, 09-15, 09-16, 09-17, 10-09, 10-11 |
| Partial check-ins | 08-27 and 10-12 (only headache answered); 09-23 (sleep not entered); 09-05 (stress not entered) |
| Seizures | 15 events on 13 days; 2 days with two events (08-09, 10-05); 1 event on a no-check-in day (08-19) |
| Seizure types | focal impaired awareness ×10, focal aware ×4, focal-to-bilateral tonic-clonic ×1 (10-14, new) |
| Short-sleep nights (< 6 h) | 24 (9 precede seizure days, 15 do not). Baseline nights are 6.3–8.4 h from the PRNG |
| High-stress days (≥ 7/10) | 14 (2 seizure days). Baseline stress 2–6 from the PRNG |
| Menstrual records | Starts 07-14, 08-11, 09-08 (approximate), 10-07 → cycles of 28, 28, 29 days; last cycle open (projected) |
| Medications | Levetiracetam 500 mg bd (since 2019) → **750 mg on 2026-09-01**; Lamotrigine (2019, stopped – rash); Midazolam nasal rescue; **Melatonin 3 mg self-started 2026-10-10** |
| Medication events | Missed doses 08-23, 08-28, 10-13; side effects 09-10 (irritability/low mood), 09-19 (afternoon tiredness) |
| History | Patient-reported attention difficulty; childhood attention concerns (never evaluated); snoring; daytime sleepiness; low mood; pending sleep-medicine referral; resolved anaemia |
| Tasks | 2 seed tasks (record appointment date; follow up on pending referral) |

Baseline noise never crosses an analysis threshold, so every expected result below follows from the explicit
overrides and can be checked by hand.

## Expected analysis outputs (default settings, 90-day period)

These numbers are asserted in `src/analysis/syntheticExpected.test.ts`.

| Analysis | Groups (eligible days / seizure days / events) | Result |
|---|---|---|
| Sleep (< 6 h vs ≥ 6 h) | 24 / 9 / 11 vs 56 / 3 / 3 | Seizure-day proportion 37.5% vs 5.4%, ratio 7.0, Fisher p ≈ 0.0007 → **possible pattern** |
| Sleep sensitivity (exclude nocturnal-only days 08-24, 10-14) | 22 / 7 vs 56 / 3 | ratio 5.9, p ≈ 0.004 |
| Sleep exclusions | 7 no-check-in days (1 event), 3 check-ins without sleep (0 events) | — |
| Menstrual phase (71 eligible days, 3 bounded cycles) | Perimenstrual 15 / 5 / 7 · Follicular 9 / 0 / 0 · Periovulatory 20 / 2 / 2 · Luteal 27 / 3 / 3 | Perimenstrual 0.47 vs 0.09 events/day, ratio 5.2, binomial p ≈ 0.005 (< 0.025), events in 3 cycles → **possible pattern** |
| Levetiracetam 750 mg (09-01) | Before 26 / 4 / 5 vs after 25 / 3 / 3 | ratio 0.62, p ≈ 0.73 → **no clear change** (missed doses 08-23, 08-28 listed as confounders) |
| Melatonin start (10-10) | Before 24 observed days vs after 9 | **suppressed** – < 14 observed follow-up days |
| Stress (≥ 7 vs < 7) | 14 / 2 vs 66 / 10 | 14.3% vs 15.2%, ratio 0.94 → **no clear pattern** |
| Frequency trend (last 30 vs earlier 60 days) | Earlier 55 / 8 / 9 vs recent 28 / 4 / 5 | 4.9 vs 5.4 per 30 days, ratio 1.09 → **no clear change** |
| Seizure type | FBTC on 10-14 not seen earlier nor in documented history | **notable change** |

Clinical connections surfaced: ADHD-related evaluation (attention symptoms + 48% of recorded days), sleep-disorder
evaluation (snoring, sleepiness, 30% poor-quality nights, sleep pattern, nocturnal seizures, pending referral),
catamenial pattern review, and change-in-seizure-pattern review (urgency "prompt"; no seizure ≥ 5 min).

With a 30-day period most comparisons are suppressed for insufficient data; the new seizure type is still flagged
against the documented history.

## Editing the dataset

Update this file and `syntheticExpected.test.ts` together (see `.kiro/steering/synthetic-data.md`).
