---
inclusion: always
---

# Synthetic Data Requirements

- Use fictional patient data exclusively. Never add real names, MRNs, dates of birth, addresses or real records.
- Every synthetic record carries `isSynthetic: true`; the UI shows a persistent "Synthetic data" banner and labels
  illustrative findings as such.
- The default dataset (`src/data/syntheticDataset.ts`) must be deterministic: fixed dates, a seeded PRNG for
  baseline noise, and explicit overrides for every value that affects an analysis threshold. Re-generating the
  dataset must always produce identical records.
- The dataset covers ~90 days (2026-07-23 → 2026-10-20) and intentionally contains:
  - days with no check-in at all (missing observations), and check-ins with individual fields missing;
  - a seizure on a day without a check-in (tests exclusion from rate denominators);
  - multiple seizures on the same day (tests seizure-day vs event counting);
  - three bounded menstrual cycles plus one open (projected) cycle and an approximate start date;
  - a dose change, a recently started supplement with insufficient follow-up, missed doses and side effects;
  - a new seizure type in the most recent 30 days.
- Expected analysis outputs for the default dataset are documented in `docs/DATASET.md` and asserted in tests.
  If the dataset changes, update both.
- Missing information is never a negative finding: `null`/`undefined` means "not recorded", not "absent".
