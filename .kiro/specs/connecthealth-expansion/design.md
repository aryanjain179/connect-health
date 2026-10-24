# Design – ConnectHealth expansion

## Storage and profiles
- New key `connecthealth:root:v2` → `{ version: 2, active: 'demo' | 'user' | null, profiles: { demo, user } }`, each
  profile an `AppState` (data, settings, period). The v1 key (`healthconnect:data:v1`) is migrated into the demo
  profile so earlier edits survive. `normalizeData` fills defaults for new collections.
- `HealthDataProvider` holds the root state; `useHealthData()` still exposes the **active** profile's `state` and a
  profile-scoped `dispatch`, so existing pages are unchanged. `rootDispatch` handles enter-demo, create-profile,
  switch and sign-out.
- Onboarding draft: `connecthealth:onboarding-draft`.

## Model additions (`src/models`)
- `PatientProfile`: preferredName, dateOfBirth, genderIdentity, pronouns, goals, trackers {seizures, menstrual},
  noKnownConditions, careTeam.
- `HealthData`: `journal`, `sharing`, `navigator` (checklists, insurance details, contact log), `reviewExcluded`.
- `CareTask` statuses: open, in-progress (started), waiting, blocked, done (completed); plus contactedWho,
  contactedOn, followUpDate, notes, links.
- Conditions from onboarding become `HistoryRecord`s: diagnosed → `diagnosis/confirmed/patient-reported`,
  suspected → `diagnosis/suspected`, symptom → `symptom/patient-reported`, tagged with catalog tags.

## Condition catalog (`src/conditions/catalog.ts`)
Starter list by category, each with tags (used by connection rules), related specialties and optional tracker
hints. Custom conditions get a `custom` tag only.

## Outcomes (`src/analysis/outcomes.ts`)
`OutcomeKey = 'seizures' | 'headache' | 'dizziness' | 'attentionDifficulty'`. For symptom outcomes the context
treats each symptom day as one event and limits observed days to days where the field was recorded (null ≠ no).
Finding ids keep their names for seizures and gain `~<outcome>` otherwise. Text uses outcome nouns.

## Review flags (`src/review/flags.ts`)
`ReviewFlag { id, findingId, level: 'red'|'amber', rule {name, basis, evidenceIds}, involvedDates, ranges, window,
comparison, counts, missing, questions }`. Red: prolonged seizure (CDC first aid; ILAE t1). Amber: possible
pattern / notable change (prototype analytic rule, thresholds documented, not validated). Insufficient findings
are listed separately. Flags are computed for every available outcome.

## Report and PDF (`src/summary`, `src/report/pdf.ts`)
`buildClinicianSummary` gains generation date, conditions, review flags (respecting `reviewExcluded`) and key
timeline events. `buildReportPdf` (jsPDF, dynamically imported) renders the same model with wrapped text,
keep-together blocks and a vector sleep/events chart with flag markers and legend. Print CSS remains as fallback.

## Navigator (`src/navigator`)
`suggestSpecialties(data, flags)` rules from catalog + symptoms + flags + care team. Pathway steps and insurance
checklist are static definitions with personalised annotations. Templates with `[placeholders]` filled from inputs.

## Assistant (`src/assistant/answer.ts`)
Keyword intent matching → deterministic answer builders returning `{ text, bullets, sources, missing, questions }`.
Safety intents first (emergency, diagnosis / prescribing requests).

## Voice journal (`src/journal`)
`useSpeechRecognition` wraps `SpeechRecognition`/`webkitSpeechRecognition`. `extractProposals(text, context)` is
pure: regex rules with negation handling, number words, medication-name matching and clarification prompts.
`applyProposals` returns reducer actions plus an undo log stored on the `JournalEntry`.

## Sharing (`src/sharing/permissions.ts`)
`filterDataForPermissions(data, permissions)` returns a reduced `HealthData`; the shared view computes everything
from the filtered data so restricted information cannot leak through derived insights.
