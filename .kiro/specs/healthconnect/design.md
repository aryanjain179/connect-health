# Technical Design – HealthConnect

## 1. Architecture

```
React UI (pages, components)
   │  reads AppState + derived results via hooks
   ▼
store/  HealthDataProvider (useReducer)  ──► storage.ts (localStorage, validation, migration)
   │  state: HealthData + settings
   ▼  derived with useMemo (pure)
analysis/  runPatternAnalysis(data, window, settings) → PatternFinding[]
clinical/  evaluateConnections(data, findings, window) → ConnectionResult[]  (uses knowledgeBase + safety)
summary/   buildClinicianSummary(data, findings, connections, window) → SummaryReport (+ toMarkdown)
data/      createSyntheticDataset() – deterministic seed data
models/    types only
```

All analysis, clinical and summary modules are pure functions of their inputs (no `Date.now()`, no randomness,
no React) so they are unit-testable and order-independent. "Today" is only used by the UI for input validation.

## 2. Data model (`src/models/types.ts`)

| Model | Key fields |
|---|---|
| `PatientProfile` | id, displayName, age, sex, conditionFocus (`'epilepsy'`), isSynthetic |
| `SeizureEvent` | id, date, time?, type (`SeizureType` incl. `'unknown'`), durationSeconds?, severity (`mild/moderate/severe`)?, preSymptoms[], postSymptoms[], recoveryMinutes?, notes, isSynthetic |
| `DailyObservation` | id, date, sleepHours\|null, sleepQuality(1–5)\|null, stressLevel(0–10)\|null, illness\|null, headache\|null, dizziness\|null, attentionDifficulty\|null, otherSymptoms[], notes |
| `MenstrualRecord` | id, periodStart, periodEnd\|null, startCertainty (`exact/approximate`), notes |
| `Medication` | id, name, indication, startDate, endDate\|null, initialDose, frequency, kind (`prescription/rescue/otc-supplement`), source, notes |
| `MedicationEvent` | id, medicationId, date, kind (`dose-change/missed-dose/side-effect`), newDose?, description |
| `HistoryRecord` | id, kind (`diagnosis/symptom/history/referral`), label, status (`confirmed/suspected/patient-reported/resolved/ruled-out/pending`), source (`clinician-documented/patient-reported/external-record`), date?, tags[], notes |
| `EvidenceEntry` | id, relationship, citation {authors, title, journal, year, volume, pages, pmid?, doi?}, url, evidenceType, population, keyFinding, limitations[], relevantSignals[], discussionPoint |
| `CareTask` | id, title, reason, kind, insightId?, dueDate?, appointmentDate?, status, createdOn |

"Not recorded" is `null` (daily fields) or absence of a record (a day with no `DailyObservation` = no check-in).
Data completeness of an observation is derived (`recorded fields / 7 core fields`), never stored.

Derived: `CycleDayInfo { date, cycleDay, cycleLength|null, phase, basis: 'recorded'|'estimated'|'projected', cycleIndex }`.

## 3. Analysis engine (`src/analysis`)

### 3.1 Common definitions

- **Analysis window**: inclusive `[start, end]`; presets anchor `end` to the latest record date.
- **Observed day**: a day in the window with a `DailyObservation` (check-in). Only observed days enter rate
  denominators. Seizures on non-observed days are counted in totals and reported as excluded.
- **Seizure day**: an observed day with ≥ 1 seizure event. Events and seizure days are reported separately.
- **Rates**: seizure-day proportion = seizure days / eligible days; event rate = events / eligible days
  (also shown per 30 days).
- **Statistics (exploratory only)**: Fisher's exact test (2×2 seizure-day × exposure) for sleep/stress; exact
  conditional binomial test for event-rate comparisons (menstrual, medication, trend). Shown with a label
  "exploratory, not adjusted for multiple comparisons".
- **Statuses**: `possible-pattern`, `no-clear-pattern`, `notable-change`, `insufficient-data` (suppressed, with
  reason) and `not-applicable`.
- **Computed confounder overlap**: for seizure days in the exposed group, counts of co-occurring short sleep,
  high stress, illness, missed dose in the previous 48 h and perimenstrual phase.

### 3.2 Sleep (`sleep.ts`)
Exposure for day D = `sleepHours` of the observation dated D (night ending on the morning of D).
Groups: short (< threshold, default 6 h) vs adequate (≥ threshold). Eligible = observed days with sleepHours
recorded. Minimums: ≥ 10 days per group, ≥ 5 seizure days total. Possible pattern if RR ≥ 1.5 and p < 0.05.
Sensitivity: repeat excluding days where every seizure occurred 00:00–05:59 (sleep may reflect the seizure).

### 3.3 Menstrual cycle (`cycle.ts`, `menstrual.ts`)
Phases follow Herzog et al. 1997 with day 1 = first day of menses and negative days counted back from the next
start: perimenstrual −3…+3, follicular 4…9, periovulatory 10…−13, luteal −12…−4. A cycle is **bounded** when the
next start is recorded; its length must be 21–45 days to be eligible. Basis: days within a logged period =
`recorded`; other bounded days = `estimated` (ovulation is never confirmed); days after the last start or before the
first = `projected` (excluded). Minimums: ≥ 2 bounded cycles, ≥ 5 eligible days per phase, ≥ 5 events. Possible
pattern if a phase's daily event rate ≥ 2× the rate on other eligible days (Herzog's proposed twofold definition),
events in that phase occur in ≥ 2 cycles, and exact binomial p < 0.05. Not applicable when no menstrual records.

### 3.4 Medication changes (`medication.ts`)
Change points = medication starts, stops and dose changes inside the window. Compare observed days in the 28 days
before (D−28…D−1) and after (D+1…D+28); change day excluded. Minimums: ≥ 14 observed days in each window and
≥ 3 events total. Result labelled a **temporal association**; missed doses and other change points within the
windows are listed as confounders. Never phrased as efficacy or as a recommendation.

### 3.5 Stress (`stress.ts`)
Exposure = same-day stress rating; high ≥ threshold (default 7/10). Same minimums and decision rule as sleep.
Limitation: ratings may be entered after a seizure (reverse causation).

### 3.6 Trend (`trend.ts`)
Recent period = last 30 days of the window; comparison = the earlier part of the window (must be ≥ 30 days,
each ≥ 14 observed days). Event-rate ratio + exact binomial test; possible change if RR ≥ 1.5 or ≤ 0.67 and
p < 0.05. New seizure type = a known type present in the recent period but absent earlier in the window and in
history → `notable-change`. Any seizure ≥ 5 min → safety flag.

### 3.7 Orchestrator (`index.ts`)
`runPatternAnalysis` sorts inputs, computes context (observed days, cycle map, completeness) once and returns
findings in a fixed order. Output depends only on the set of records, not their order.

## 4. Clinical connections (`src/clinical`)

- `knowledgeBase.ts`: curated entries with verified PubMed/CDC URLs (see `docs/CITATIONS.md`).
- `connections.ts`: one rule per connection. Each rule collects typed **signals**
  (`confirmed-diagnosis`, `patient-reported-symptom`, `calculated-pattern`, `daily-observation`) and returns either
  `surfaced` with a `hypothesis`, or `not-surfaced` with the reason.
  - ADHD: requires an epilepsy diagnosis **and** ≥ 1 attention-related signal (patient-reported symptom/history
    tag, or attention difficulty on ≥ 30% of ≥ 14 recorded days). Existing ADHD diagnosis → shown as documented,
    not suggested. Confounders: sleep loss, seizures, antiseizure-medication side effects.
  - Sleep disorder: requires epilepsy **and** ≥ 1 of snoring / witnessed apnoea / daytime sleepiness reports, a
    sleep possible-pattern, or poor sleep quality on ≥ 30% of recorded nights.
  - Catamenial pattern: requires the menstrual finding to be `possible-pattern`.
  - Changing seizure pattern: requires a trend `possible-pattern`/`notable-change` or a seizure ≥ 5 min. Routes to
    the safety protocol, never to a disease prediction.
- `safety.ts`: `findUnsafeLanguage(text)` (diagnostic claims, causation, probabilities, medication directives,
  cancer prediction), `validateEvidenceEntry`, `validateConnection` (every evidence id must exist in the KB and pass
  validation). Invalid connections are dropped; tests assert all generated text passes.

## 5. UI (`src/pages`, `src/components`)

- Layout: sidebar + top bar (period selector, synthetic badge) + content. Mobile: menu toggle.
- Overview: profile, diagnoses, medications, KPI tiles, sleep chart (Recharts, `connectNulls={false}`), cycle strip,
  recent observations, active insights, completeness bars.
- Timeline: date range inputs + presets, layer toggles, composed chart (sleep bars + seizure markers), lane grid
  (cycle, medication, symptoms, check-in), day inspector with edit/delete.
- Pattern Discovery: thresholds (sleep, stress) → recompute; `InsightCard` per finding with expandable calculation
  table and group-rate bar chart.
- Clinical Connections: information-type legend, surfaced connection cards, safety protocol card, evidence library
  with surfaced / not-surfaced reasons.
- Clinician Summary: rendered report, Copy / Download .md / Print.
- Care Tasks: list grouped by status, create/edit/delete, status change.
- Records: tabbed tables + modal forms with validation, export/import JSON, reset to synthetic.

## 6. Persistence

`storage.ts` saves `{ version: 1, data, settings }` under `healthconnect:data:v1` after every reducer change.
On load it validates shape; invalid or missing data falls back to the synthetic dataset (with a notice).

## 7. Safety constraints (summary)

See `.kiro/steering/clinical-safety.md`. Enforced in code by `safety.ts`, rule preconditions, suppression
minimums and tests.

## 8. Testing strategy

Vitest unit tests for dates, cycle mapping, each analysis module (hand-computed fixtures), orchestrator invariants
(order, missing ≠ 0, events ≤ recorded), synthetic-dataset expected outputs, connections/safety, summary, reducer
recalculation and storage round-trip. A React Testing Library smoke test renders the app, adds a record and checks
persistence after remount.
