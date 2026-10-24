# Analysis methods

All calculations are deterministic TypeScript functions in `src/analysis/` with no randomness, no clock access and
no dependence on input order. They describe **observational associations** in diary data; they never establish
cause and effect or identify confirmed triggers.

## Shared definitions

- **Observation window** – the selected period (30/60/90 days or all records), anchored to the latest record date.
- **Observed day** – a day with a daily check-in. Only observed days enter rate denominators. Days without a
  check-in are reported as excluded; seizures on them count in totals but not in comparisons. Missing values are
  never treated as zero or "no".
- **Seizure day** – an observed day with ≥ 1 seizure. Exposure units are days, so two seizures on one day are one
  seizure day; events are reported separately.
- **Rates** – seizure-day proportion = seizure days ÷ eligible days; event rate = events ÷ eligible days (also shown
  per 30 days).
- **Exploratory statistics** – Fisher's exact test (two-sided) for seizure-day proportions; exact conditional
  binomial test (two-sided) for event-rate comparisons. Not adjusted for multiple comparisons except where noted.
- **Status** – `possible-pattern`, `no-clear-pattern`, `notable-change`, `insufficient-data` (suppressed with a
  reason) or `not-applicable`.
- **Computed confounder overlap** – for seizure days in the exposed group, how many also had short sleep, high
  stress, illness, a missed dose in the previous 48 h, or a perimenstrual phase.

## 1. Sleep duration (`sleep.ts`)

- Exposure for day D = `sleepHours` on the check-in dated D = the night that **ended on the morning of D**.
- Groups: short (< threshold, default 6 h) vs ≥ threshold. Check-ins without sleep are excluded.
- Minimums: ≥ 10 eligible days per group and ≥ 5 seizure days in total.
- Possible pattern: ratio ≥ 1.5 and p < 0.05.
- Sensitivity analysis excludes days where every seizure began 00:00–05:59, because the seizure may have shortened
  the recorded night.

## 2. Menstrual-cycle phase (`cycle.ts`, `menstrual.ts`)

- Day 1 = first day of recorded bleeding; negative days count back from the next recorded start.
- Phases (Herzog et al. 1997): perimenstrual −3…+3, follicular 4…9, periovulatory 10…−13, luteal −12…−4.
- Basis: `recorded` (within a logged period), `estimated` (bounded cycle, calendar counting – ovulation never
  confirmed), `projected` (after the last or before the first recorded start).
- Eligible days: observed days in **bounded** cycles of 21–45 days. Projected days and implausible cycle lengths
  (possible missed period records) are excluded and reported.
- Rate = events per eligible day by phase. Pre-specified comparisons: perimenstrual and periovulatory vs all other
  eligible days.
- Minimums: ≥ 2 bounded cycles, ≥ 5 eligible days per phase, ≥ 5 events on eligible days.
- Possible pattern: phase rate ≥ 2× other days (Herzog's proposed twofold level), events in ≥ 2 cycles, and
  Bonferroni-adjusted p < 0.025.
- Not applicable when no cycle records exist (not interpreted as the absence of a cycle).

## 3. Medication changes (`medication.ts`)

- Change points: starts, stops and dose changes inside the window.
- Compare observed days D−28…D−1 with D+1…D+28 (change day excluded; windows clipped to the analysis window).
- Minimums: ≥ 14 observed days in each window and ≥ 3 events in total.
- Reported as a **temporal association**: no treatment-effect language. Missed doses, other changes within 28 days
  and regression to the mean are listed as confounders; side effects reported after the change are shown.

## 4. Stress (`stress.ts`)

- Exposure: same-day stress rating; high ≥ threshold (default 7/10).
- Same minimums and decision rule as sleep. Limitation: ratings can be influenced by a seizure on the same day.

## 5. Change over time (`trend.ts`)

- Frequency: last 30 days vs the earlier part of the window (requires ≥ 30 earlier days and ≥ 14 observed days in
  each part, ≥ 3 events). Possible change if ratio ≥ 1.5 or ≤ 0.67 and p < 0.05.
- Type: a known seizure type in the last 30 days that is absent earlier in the window and from documented history
  (`seizure-type:<type>` tags) is a `notable-change`. With a short period, the comparison falls back to documented
  history. Seizures ≥ 5 minutes are always flagged for the safety protocol.

## Clinical connections (`src/clinical/connections.ts`)

Rules surface a connection only when patient-specific signals exist; a confirmed epilepsy diagnosis alone never
surfaces anything. Each surfaced connection must pass `validateConnection` (known, valid evidence ids; a hypothesis;
a signal beyond the diagnosis; no unsafe language) or it is suppressed.

| Connection | Required signals |
|---|---|
| ADHD-related evaluation | Confirmed epilepsy **and** a patient-reported attention signal, or attention difficulty on ≥ 30% of ≥ 14 recorded days. Not surfaced if ADHD is documented or ruled out. |
| Sleep-disorder evaluation | Confirmed epilepsy **and** reported snoring / witnessed apnoea / daytime sleepiness / insomnia / morning headache, or poor sleep quality (1–2/5) on ≥ 30% of ≥ 14 nights. |
| Catamenial pattern review | Menstrual analysis status `possible-pattern`. |
| Change in seizure pattern | New seizure type, frequency increase, or seizure ≥ 5 min (urgency `emergency-guidance` in that case). |

## Safety validation (`src/clinical/safety.ts`)

`findUnsafeLanguage` rejects causal claims, "confirmed trigger", undocumented diagnosis claims, individual
probabilities or risk scores, medication directives and cancer/tumour terms (negated sentences are allowed for the
first rules). Tests run it over every generated finding, connection and summary line.
