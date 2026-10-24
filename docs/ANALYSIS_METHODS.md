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

---

# ConnectHealth expansion

## Outcomes (`src/analysis/outcomes.ts`)

The engine can analyse seizures (event diary) or a recorded daily symptom: headache, dizziness or attention
difficulty. For a symptom outcome each day with the symptom answered "yes" is one event, and **only days where the
question was answered** are observed – unanswered days are excluded, never treated as "no". Free-text symptoms
(`otherSymptoms`) are not analysable because their absence is never recorded. Finding ids gain a `~<outcome>`
suffix; seizure-specific evidence is not attached to other outcomes; the seizure-type analysis runs only for seizures.

## Condition-driven check-in (`src/conditions/checkin.ts`)

Core questions are asked of everyone. Extra questions come from the conditions recorded in the profile (diagnosed,
suspected or symptom-only, via `condition:<id>` tags – symptoms never receive the bare diagnosis tag used by
connection rules). The seizure log appears only for epilepsy, or when seizures are already recorded. A question that
already has answers stays visible. Logging only a seizure does not create an empty check-in, so rate denominators are
not biased towards seizure days. Yes/no condition measures (e.g. digestive symptoms, fatigue, low mood) are
analysable outcomes (`measure:<id>`) with the same rule that unanswered days are excluded; numeric measures (pain,
blood pressure, glucose) are summarised descriptively in the report only.

**Menstrual bleeding** (`src/conditions/menstrualBleeding.ts`): with cycle tracking on, the check-in asks whether there
was menstrual bleeding that day. "Yes" extends a period that ended up to 2 days earlier (or moves a start up to 2 days
later back), otherwise starts a new one-day period; "No" trims a period's first or last day or removes a one-day
period, but never splits a period; "not recorded" changes nothing. Cycle phases are then computed from these period
records exactly as before. Bleeding answers fall under the menstrual-cycle sharing permission, not symptoms.

## Clinician-review flags (`src/review/flags.ts`)

| Level | Rule | Basis |
|---|---|---|
| Red | A recorded seizure lasting ≥ 5 minutes | Documented guidance: CDC seizure first aid; ILAE status epilepticus t1 = 5 min (tonic-clonic) |
| Amber | Any finding with status `possible-pattern` or `notable-change` | Prototype analytic rule (thresholds above) – **not** a validated clinical rule |
| — | Findings with `insufficient-data` | Listed as "Insufficient data to assess this pattern"; never flagged |

Each flag records involved dates, comparison ranges, observation window, counts, missing data and patient questions.
Patient-facing text is fixed and neutral and never names a disease. Users can leave a flag out of the report.

## Care Navigator (`src/navigator/navigator.ts`)

Specialties come from: catalog specialties of recorded diagnoses (diagnosed or suspected), symptom tags (e.g.
snoring → sleep medicine; attention → psychiatry/psychology), review flags (sleep pattern → sleep medicine; new
seizure type or prolonged seizure → neurology; cycle pattern → gynecology) and surfaced connections. Primary care is
always offered. Care-team members are noted. Referral notes depend only on the plan type the user records, and they
always end in "confirm with your insurer".

## Ask My Health Data (`src/assistant/answer.ts`)

Ordered keyword intents: emergency → safety (diagnosis, prescribing, "is it cancer") → tasks → medication →
appointment → sleep → cycle → stress → discuss → last event → missing data → patterns → unsupported. Every answer is
built from the current bundle (records, findings, flags, connections, completeness) and lists sources and missing
data.

## Voice Journal (`src/journal`)

The extractor splits the transcript into clauses and proposes only explicitly stated values: sleep hours (digits or
number words, "and a half"), stress ratings only when a number out of 10 is said (descriptive words become a note
plus an optional rating prompt), yes/no symptoms with simple negation, seizures (time/duration only if stated, type
"unknown"), missed doses / side effects (medication matched by name, otherwise a clarification), and menstrual bleeding yes/no for the day.
Approved proposals become reducer actions; the journal entry stores created record ids and previous field values so
the entry and its records can be removed.

## Sharing (`src/sharing/permissions.ts`)

`filterDataForPermissions` returns a reduced dataset; the shared view recomputes analyses and reports from it, so a
person with "insights" but not "events" cannot see seizure-derived patterns. Journal transcripts and sharing settings
are never shared. Access requires `status = active` and at least one permission; revoking clears permissions.
