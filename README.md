# HealthConnect – Patient Health Intelligence Platform (prototype)

HealthConnect helps patients and clinicians understand longitudinal epilepsy data. It aligns seizures with sleep,
menstrual-cycle timing, medications and other symptoms. It calculates transparent personal patterns and surfaces
evidence-informed connections for clinician review.

> **Synthetic data only.** The patient ("Maya R.") and every record are fictional. Findings are illustrative
> calculations from demo records. This is not a medical device and gives no medical advice, diagnoses, risk
> estimates or treatment recommendations.

## Quick start

Requirements: Node.js ≥ 20.19 (developed with Node 26.12.1 / npm 11.20) and a modern browser. No database, API key,
account or network service is needed at runtime.

```bash
npm install        # pinned dependency versions
npm run dev        # http://localhost:5173
npm test           # 74 Vitest tests (unit + UI)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

**Apple Silicon note:** this machine had an x86_64 Node at `/usr/local/opt/node/bin` that cannot run without
Rosetta (`Bad CPU type in executable`). A native build was installed with Homebrew (`/opt/homebrew/bin/brew install
node`). Put it first on your `PATH`, for example `export PATH=/opt/homebrew/bin:$PATH` in `~/.zshrc`.

## Features

| Area | What it does |
|---|---|
| Overview | Profile, documented diagnoses, current medications and history, seizure count and seizure days, most recent seizure, sleep trend (gaps for missing nights), cycle strip (recorded / estimated / projected), recent observations, active insights, per-field completeness |
| Health Timeline | Date-range filter and presets, layer toggles, sleep + seizure chart, aligned lanes (seizures, sleep, medication, symptoms, check-ins, cycle), day inspector with edit/delete |
| Pattern Discovery | Deterministic engine: sleep, menstrual phase, medication changes, stress, frequency and type change. Each card shows window, groups, denominators, rates, exploratory tests, exclusions, computed confounder overlap, limitations, evidence and a discussion point. Adjustable thresholds; suppression when data are insufficient |
| Clinical Connections | Curated knowledge base (8 verified sources). ADHD, sleep-disorder, catamenial and changing-pattern rules surface only with patient-specific signals. Includes an information-type legend, a safety protocol, reasons for non-surfaced rules and an evidence library |
| Clinician Summary | Report generated from current data with labelled items (diagnosis / patient-reported / observation / calculated pattern / hypothesis / limitation). Copy, download as Markdown, print to PDF |
| Care Tasks | Create tasks from any insight or manually; track open / in progress / done, due and appointment dates |
| Records | Add / edit / delete every record type with validation; export / import JSON; reset to synthetic data |

Data persist in `localStorage` (`healthconnect:data:v1`) and every change recalculates all views.

## Project structure

```
.kiro/
  steering/      product, design-principles, synthetic-data, clinical-safety, tech
  specs/healthconnect/  requirements.md, design.md, tasks.md
  hooks/         run tests on engine save; citation-verification reminder
docs/            DATASET.md, ANALYSIS_METHODS.md, CITATIONS.md, TESTING_CHECKLIST.md
src/
  models/        TypeScript types only
  data/          deterministic synthetic dataset
  analysis/      pure pattern-discovery engine + descriptive helpers
  clinical/      knowledge base, connection rules, safety validators
  summary/       clinician summary generator
  store/         reducer, validation, localStorage persistence, React context
  components/    UI primitives, charts, insight card, forms
  pages/         one file per sidebar view
```

## Documentation

- [Synthetic dataset and expected outputs](docs/DATASET.md)
- [Analysis methods](docs/ANALYSIS_METHODS.md)
- [Verified citations](docs/CITATIONS.md)
- [Testing checklist](docs/TESTING_CHECKLIST.md)

## How Kiro was used

- **Steering** (`.kiro/steering/`): product scope, design principles, synthetic-data rules, clinical-safety rules and
  tech/commands. These were written before any code and applied to every later step.
- **Spec** (`.kiro/specs/healthconnect/`): EARS requirements, technical design and an ordered 8-stage task list. Tasks
  were checked off as each stage passed its tests and build.
- **Hooks** (`.kiro/hooks/`): a `PostFileSave` command hook runs the test suite when engine, clinical, summary,
  store or data files are saved, and an agent hook reminds the agent to verify citations when the knowledge base
  changes. Both were created during this session. Per Kiro, hooks become active from the next session.

## Known limitations

- Single fictional patient. No authentication, sync or multi-user support. Data live only in this browser.
- Analyses are exploratory. Small samples, several comparisons and self-reported data make results uncertain.
  Thresholds (6 h, 7/10, 28-day windows, minimum counts) are pragmatic prototype choices, not validated cut-offs.
- Cycle phases are calendar estimates. Ovulation is not confirmed and hormonal contraception is not modelled.
- Medication analysis shows temporal associations only. It cannot assess efficacy.
- The knowledge base is small and hand-curated. The safety protocol's "contact clinician about a new seizure type"
  step is a prototype rule that has not been clinically validated.
- No optional LLM explanations are implemented. The app is fully functional without one.
- Accessibility follows good practice (labels, landmarks, focus rings, non-colour cues). Full WCAG validation needs
  manual testing with assistive technologies and expert review.
- The production bundle is a single ~810 kB chunk (~236 kB gzip), mostly Recharts.
