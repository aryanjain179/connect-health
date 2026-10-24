# ConnectHealth – Health intelligence & navigation (prototype)

ConnectHealth helps people with **any chronic condition** bring their health information together, see patterns worth
discussing, prepare for appointments, understand possible next steps, and navigate referrals and insurance. It began
as an epilepsy prototype; epilepsy remains one condition in the library and the condition of the synthetic demo
patient.

> **Prototype.** Everything runs in your browser. Profiles are stored in `localStorage`, which is **not secure
> storage for real medical records**. The demo patient ("Maya R.") and all of her records are fictional. ConnectHealth
> does not diagnose, predict disease, recommend treatment, or contact anyone.

## Quick start

Requirements: Node.js ≥ 20.19 (developed with Node 26.12.1) and a modern browser. No database, API key, account or
backend is needed.

```bash
npm install        # pinned dependency versions
npm run dev        # http://localhost:5173
npm test           # 131 Vitest tests (unit + UI journey)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

**This Mac:** the Intel Node at `/usr/local/opt/node/bin` cannot run on Apple Silicon. Use the Homebrew arm64 Node:
`export PATH=/opt/homebrew/bin:$PATH` (add it to `~/.zshrc`).

**Demo shortcuts:** the app opens on the welcome screen. `http://localhost:5173/#/demo` jumps straight into the demo
patient (`#/demo/review`, `#/demo/navigator`, … open a specific page).

**Tech stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Recharts 3, Lucide React, jsPDF 4 (lazy-loaded,
client-side PDF). Tests use Vitest 5, jsdom and Testing Library. All versions are pinned exactly.

## Demo walkthrough (about 3 minutes)

1. Open the app and choose **Explore Demo Patient** (Maya R., synthetic, epilepsy, 90 days of records).
2. On the **Overview**, use the “How are you today?” card: **Start today’s check-in** shows the condition-driven form
   with the inline seizure log; **Speak about my day** opens the Voice Journal.
3. In the **Voice Journal**, say or type “I slept about five hours last night, felt unusually anxious this morning,
   and had a headache after lunch”, then approve, edit or reject each proposed entry.
4. Open **Clinician Review** to see the four amber possible-pattern flags, with chart markers, dates, denominators
   and missing data. (Logging a seizure of 5 minutes or longer adds a red flag.)
5. Check **Pattern Discovery** and **Clinical Connections**, then ask a question in **Ask My Health Data**
   (e.g. “Have my symptoms changed since my medication was adjusted?”).
6. Explore **Care Navigator** next steps, then **Download PDF** from the Clinician Summary.
7. In **Settings → People & Data Sharing**, add a trusted person, choose permissions and **Preview shared view**.
8. To try your own profile, go back to the welcome screen and choose **Create My Health Profile**.

## The journey

Sign up → select conditions and goals → record health information (forms or Voice Journal) → discover patterns →
review flagged findings → ask questions → explore care-navigation next steps → generate a report → share selected
information with a trusted person (local preview).

| Page | What it does |
|---|---|
| Welcome & onboarding | Create My Health Profile (5 steps: about you · searchable condition library with diagnosed / suspected / symptom · allergies (quick picks, reaction, severity, “no known allergies”) · goals and optional trackers · review) or Explore Demo Patient. Draft progress is saved locally. |
| Recording today | A “How are you today?” card at the top of the Overview, a “Record today” block at the top of the sidebar (with done / not-done status), a filled Daily check-in button with a reminder dot in the header, and a sticky Speak / Check in bar on phones. The check-in form and voice journal link to each other. |
| Daily check-in | Core questions for everyone (sleep, stress, illness, other symptoms) plus questions driven by your conditions: the **seizure log only for epilepsy**, headache for migraine, pain level for chronic pain or fibromyalgia, blood pressure for hypertension, digestive symptoms for IBS/IBD, breathing symptoms and inhaler use for asthma, and more. When cycle tracking is on, the check-in asks **“Menstrual bleeding on this day?”** (yes / no / not recorded); consecutive bleeding days build the period records used by the cycle analysis. |
| Overview | Personalised to conditions, goals and trackers: KPIs, allergies, conditions, medications, sleep chart with review markers, optional cycle strip (dated period starts, weekly date axis, hover detail, dated event list), completeness, suggested next steps, active insights. |
| Health Timeline | Aligned lanes (review markers, seizures, sleep, medication, symptoms, check-ins, cycle), date filter, deep links (`#/timeline?date=YYYY-MM-DD`), day inspector with edit/delete. |
| Pattern Discovery | Deterministic engine for seizures **or** recorded daily symptoms (headache, dizziness, attention difficulty): sleep, cycle phase, medication changes, stress, trends. Denominators, exclusions, confounders, limitations. |
| Clinician Review | Red/amber flags with chart markers, dates, windows, counts, missing data, rule basis, include-in-report toggle, questions; "Insufficient data to assess this pattern" list; review PDF. |
| Clinical Connections | Curated, verified knowledge base (currently epilepsy-related); surfaced only with patient-specific signals. |
| Ask My Health Data | Rule-based prototype assistant (no AI model) answering from your records with sources, missing information and clinician questions. |
| Voice Journal | Browser speech recognition (or typing) → deterministic extraction → approve / edit / reject each proposal → only approved entries are saved; undo per entry. |
| Care Navigator | Specialty/service suggestions with reasons and uncertainty, 7-step pathway, insurance checklist, contact log, copyable templates, tasks. |
| Care Tasks | Statuses not started / started / waiting / blocked / completed, contacts, follow-ups, notes, links. |
| Clinician Summary | Report from current data; **Download PDF** (jsPDF, generated client-side), Print / Save as PDF, copy, Markdown. |
| Records | Add / edit / delete every record type, including allergies; import / export JSON; reset demo. |
| Settings & Sharing | Edit profile, trackers, goals, care team; switch or delete profiles; **People & Data Sharing** with granular permissions, confirm, revoke and an enforced **Preview shared view**. |

## Project structure

```
.kiro/
  steering/   product, design-principles, synthetic-data, clinical-safety, tech
  specs/connecthealth/          original spec (requirements, design, tasks)
  specs/connecthealth-expansion/   expansion spec (requirements, design, tasks)
  hooks/      run tests on save; citation-verification reminder
docs/         DATASET.md, ANALYSIS_METHODS.md, CITATIONS.md, TESTING_CHECKLIST.md
src/
  models/ data/ analysis/ clinical/ summary/ store/   (original layers)
  conditions/   starter condition catalog + specialties
  onboarding/   draft model, validation, profile creation
  review/       clinician-review flag rules
  report/       jsPDF report renderer + buttons
  navigator/    specialty suggestions, pathway, checklist, templates
  assistant/    rule-based question answering
  journal/      speech hook, extractor, apply/undo
  sharing/      permission filter
  components/ pages/
```

## Clinical safety by design

- **No causation, diagnosis or prediction.** Findings say “associated with” or “possible pattern”, never “trigger”.
  ConnectHealth gives no disease probabilities and no medication advice. Medication analyses describe timing only.
- **Missing is not zero.** Days without a check-in are excluded from denominators. Every rate shows its denominator,
  window and comparison group. Seizure days are counted separately from seizure events.
- **Flags are honest about their basis.** Red is reserved for a recorded seizure of 5 minutes or longer (CDC first
  aid, ILAE status epilepticus definition). Amber findings come from prototype heuristics and are labelled that way.
  With too little data, the app says “Insufficient data to assess this pattern” instead of flagging.
- **Curated evidence only.** Citations come from `src/clinical/knowledgeBase.ts`, and each one has a verified PubMed
  or official URL. A connection appears only when patient-specific signals support it.
- **Allergies.** No records means “not recorded”. Only an explicit “no known allergies” answer is shown as none.
  Medication–allergy notices are simple name matches, not a drug-safety check.
- **Patient stays in control.** The Voice Journal saves nothing without approval. Sharing is a local preview, and
  nothing is ever sent to a clinician, insurer or caregiver.

The full rules are in `.kiro/steering/clinical-safety.md`. They are also asserted in tests, including an
unsafe-language scan over generated text.

## Data and storage

- The **demo patient** and **your own profile** are separate. You can switch or delete either one in Settings.
- Everything is stored in `localStorage` under `connecthealth:root:v2`. Data from older versions
  (`healthconnect:data:v1`) is migrated automatically.
- **Records** lets you export and import JSON, and reset the demo patient to its original synthetic dataset.
- The synthetic dataset is deterministic: it uses fixed dates and a seeded generator. Its expected analysis
  results are documented in `docs/DATASET.md` and asserted in tests.

## Documentation

| File | Contents |
|---|---|
| `docs/DATASET.md` | Synthetic demo patient, deliberate edge cases and expected analysis outputs |
| `docs/ANALYSIS_METHODS.md` | How each pattern analysis, threshold and review flag works |
| `docs/CITATIONS.md` | Verified sources in the knowledge base |
| `docs/TESTING_CHECKLIST.md` | Automated coverage plus manual test steps |

## How Kiro was used

- **Steering** (`.kiro/steering/`) holds five always-on rule files: product scope, design principles,
  synthetic-data rules, clinical-safety rules, and tech stack and commands. Every feature was built against them.
- **Specs** were written before code. `connecthealth` covers the original epilepsy prototype.
  `connecthealth-expansion` adds condition-agnostic onboarding, review flags, PDF, navigator, assistant, voice
  journal, sharing, the condition-driven check-in, and allergies. Both use EARS requirements, a design and staged
  tasks, and each task was checked off only after tests and the build passed.
- **Hooks**: `run-tests-on-engine-save` runs the test suite when analysis, clinical, summary or other core modules
  are saved. `verify-citations-on-kb-save` reminds the agent to re-verify citations whenever the knowledge base
  changes.

## Known limitations

- Local-only prototype: no authentication, sync, invitations or remote access. Sharing is a local preview.
- `localStorage` is not secure storage for protected health information.
- Voice Journal uses the browser's Web Speech API where available; in some browsers (e.g. Chrome) audio is processed
  by the browser vendor's online service. Extraction is keyword-based and will miss or misread phrasing – which is why
  every proposal needs approval.
- Ask My Health Data is a rule-based prototype with a fixed set of intents; it is not a language model.
- Condition-specific check-in questions are a starter set chosen for this prototype, not a validated instrument.
- Pattern thresholds and amber flag rules are prototype heuristics, not validated clinical rules. Red flags exist only
  for the documented ≥ 5-minute seizure rule.
- The clinical knowledge base covers epilepsy-related connections only; other conditions get specialty suggestions
  from the catalog but no evidence-based connections yet.
- Specialty suggestions and referral notes are general prompts; ConnectHealth does not know anyone's coverage.
- The PDF uses Helvetica, so a few Unicode symbols are transliterated (e.g. "≥" → ">=").
- Full WCAG conformance needs manual testing with assistive technologies and expert review.
