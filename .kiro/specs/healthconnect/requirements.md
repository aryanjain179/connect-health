# Requirements – HealthConnect Patient Health Intelligence Platform

## Introduction

HealthConnect helps patients and clinicians understand longitudinal epilepsy data by aligning seizure events with
sleep, menstrual-cycle timing, medications and other symptoms, calculating transparent personal patterns, and
surfacing evidence-informed potential connections for clinician review. The prototype uses fictional data only,
runs locally in the browser and does not require an LLM, external API or database.

Acceptance criteria use EARS notation (WHEN / IF / THE SYSTEM SHALL).

---

## R1 – Application shell and navigation

**User story:** As a user, I want a clear clinical interface with consistent navigation so I can move between views.

1. THE SYSTEM SHALL show a left sidebar with Overview, Health Timeline, Pattern Discovery, Clinical Connections,
   Clinician Summary, Care Tasks and a Records (data entry) item.
2. THE SYSTEM SHALL show a persistent banner stating that all records are synthetic and findings are illustrative.
3. WHEN the viewport is narrower than the large breakpoint THE SYSTEM SHALL collapse the sidebar into a toggleable menu.
4. THE SYSTEM SHALL provide a global analysis-period selector (30 / 60 / 90 days / all records) anchored to the most
   recent recorded date, used by Overview, Pattern Discovery, Clinical Connections and Clinician Summary.
5. THE SYSTEM SHALL NOT render any control that has no function.

## R2 – Data model and synthetic dataset

**User story:** As a developer, I want reusable typed models and a coherent synthetic dataset so analyses are testable.

1. THE SYSTEM SHALL define TypeScript models for seizure events, daily observations, menstrual-cycle records,
   medications and medication events (dose changes, missed doses, side effects), medical-history records,
   clinical evidence entries, care tasks and the patient profile.
2. Seizure events SHALL include id, date, optional time, type (or "unknown"), duration, severity, symptoms before and
   after, recovery time and notes.
3. Daily observations SHALL include date, sleep duration and quality, stress level, illness, headache, dizziness,
   attention/concentration difficulty and other symptoms; every field SHALL allow "not recorded" (`null`).
4. Menstrual records SHALL include period start and end and start-date certainty; computed cycle day and phase SHALL
   carry a basis of `recorded` (menses logged), `estimated` (calendar counting in a bounded cycle) or `projected`.
5. Medical-history records SHALL include kind, label, status and source.
6. THE SYSTEM SHALL ship a deterministic ~90-day synthetic dataset (2026-07-23 → 2026-10-20) including missing days,
   missing fields, same-day multiple seizures, a seizure on a no-check-in day, bounded and projected cycles, a dose
   change, a recent supplement start, missed doses, side effects and a new seizure type.
7. THE SYSTEM SHALL keep models, synthetic data, calculations and UI in separate modules.
8. THE SYSTEM SHALL NOT interpret missing information as a negative finding.

## R3 – Overview dashboard

**User story:** As a patient or clinician, I want a summary of the current picture at a glance.

1. THE SYSTEM SHALL display the fictional profile, documented diagnoses with status and source, current medications
   and treatment history.
2. THE SYSTEM SHALL display seizure events and seizure days in the selected period and the most recent seizure.
3. THE SYSTEM SHALL display a sleep trend chart in which missing nights appear as gaps (not zero).
4. THE SYSTEM SHALL display a menstrual-cycle strip where relevant, visually distinguishing recorded, estimated and
   projected phases with text labels.
5. THE SYSTEM SHALL display recent observations, active insights (possible patterns and surfaced connections) and
   data-completeness indicators per field.

## R4 – Interactive health timeline

**User story:** As a clinician, I want to see all factors aligned on one time axis and inspect any day.

1. THE SYSTEM SHALL align seizure events, sleep, cycle phases, medication changes and other symptoms on a shared
   daily axis.
2. WHEN the user changes the start/end date filter THE SYSTEM SHALL update the timeline to that range.
3. WHEN the user toggles a layer THE SYSTEM SHALL show or hide that lane.
4. WHEN the user selects a day THE SYSTEM SHALL show every record on that day with edit and delete actions.
5. THE SYSTEM SHALL mark days without a check-in as "missing" and estimated/projected phases as such.

## R5 – Patient data entry and persistence

**User story:** As a patient, I want to add, edit and delete my records and have them saved locally.

1. THE SYSTEM SHALL allow add / edit / delete of seizure events, daily observations, menstrual records, medications,
   medication events and patient-reported symptoms / history records.
2. IF an input is invalid (e.g. missing date, end before start, sleep outside 0–24 h, stress outside 0–10, duplicate
   observation date, future date beyond today) THEN THE SYSTEM SHALL show a field-level error and not save.
3. WHEN a record changes THE SYSTEM SHALL persist to `localStorage` and recompute dashboard, timeline, patterns,
   connections and summary.
4. WHEN the page is reloaded THE SYSTEM SHALL restore the saved data.
5. THE SYSTEM SHALL allow export (JSON) and import of data, and reset to the synthetic dataset after confirmation.

## R6 – Personal pattern-discovery engine

**User story:** As a clinician, I want transparent, deterministic calculations of personal patterns.

1. THE SYSTEM SHALL analyse: (a) sleep duration, (b) menstrual-cycle phase, (c) medication changes, (d) stress,
   (e) changes in seizure frequency or type over time.
2. For each finding THE SYSTEM SHALL report observation window, comparison groups, eligible-day denominators,
   seizure-day and event counts, rates, rate ratio where supported, excluded days and reasons, potential
   confounders (including computed overlap with other recorded factors) and limitations.
3. Sleep: the exposure for calendar day D SHALL be the sleep observation recorded on D (the night ending on the
   morning of D). Exposure units SHALL be days; multiple seizures on one day SHALL count as one seizure day.
4. Menstrual: THE SYSTEM SHALL compare seizure events per eligible observed day by phase, using only days in bounded
   cycles of plausible length (21–45 days); projected days SHALL be excluded.
5. Medication: THE SYSTEM SHALL compare fixed windows before and after each start, stop or dose change and SHALL
   describe results as temporal associations, not treatment effects; missed doses SHALL be listed as confounders.
6. Days without a check-in SHALL be excluded from rate denominators; seizures on such days SHALL be counted in totals
   and reported as excluded from comparisons.
7. IF eligible days or seizure counts are below documented minimums THEN THE SYSTEM SHALL suppress the finding with a
   reason.
8. Results SHALL be independent of input record order.
9. THE SYSTEM SHALL NOT claim causation or label a factor a confirmed trigger.

## R7 – Evidence-informed clinical connections

**User story:** As a clinician, I want potential comorbidities surfaced only when there is a patient-specific reason.

1. THE SYSTEM SHALL use a curated knowledge base whose entries include relationship, citation, URL, population,
   limitations, relevant signals and a clinician discussion point.
2. THE SYSTEM SHALL evaluate at least: epilepsy & ADHD, epilepsy & sleep disorders, catamenial pattern, and changes in
   seizure pattern that may warrant evaluation.
3. THE SYSTEM SHALL surface a connection only when patient records provide a relevant signal; epilepsy alone SHALL NOT
   trigger an ADHD suggestion.
4. THE SYSTEM SHALL label every item as confirmed diagnosis, patient-reported symptom, population-level association,
   patient-specific calculated pattern or potential clinical hypothesis.
5. THE SYSTEM SHALL show, for non-surfaced KB entries, why they were not surfaced.
6. WHEN any seizure has duration ≥ 5 minutes or a new seizure type is recorded THE SYSTEM SHALL show the safety
   protocol (contact treating clinician; emergency guidance) rather than any disease prediction.
7. THE SYSTEM SHALL NOT fabricate citations, diagnose, compute individual disease probabilities, recommend medication
   changes or predict cancer.

## R8 – Insight cards

1. Each insight card SHALL show title, plain-language explanation, category, supporting data and calculations,
   observation window, data completeness, evidence source where applicable, confounders, limitations and a
   suggested clinician discussion point.
2. Personal patterns and evidence-informed connections SHALL be shown in separate sections/pages.
3. WHEN the user clicks "Create follow-up task" on an insight THE SYSTEM SHALL open a prefilled task form linked to it.

## R9 – Clinician summary

1. THE SYSTEM SHALL generate a report from current data containing history, seizure frequency and change, sleep /
   cycle / medication context, supported patterns, potential comorbidities for review, patient-reported concerns,
   missing data and limitations, suggested appointment questions and outstanding tasks.
2. THE SYSTEM SHALL label observations, hypotheses and established diagnoses distinctly.
3. THE SYSTEM SHALL allow copy to clipboard, download (Markdown) and print.

## R10 – Care tasks

1. THE SYSTEM SHALL allow creating, editing, deleting and changing status (open / in progress / done) of tasks with
   title, reason, kind, linked insight (optional), due date (optional), appointment date (optional).
2. THE SYSTEM SHALL NOT order tests, make referrals, contact providers or change treatment.

## R11 – Testing and safeguards

1. Automated tests SHALL cover: counts and rates, denominators, missing sleep, incomplete cycles, medication changes
   in the window, insufficient samples, recalculation after edit/delete, persistence after reload, evidence
   requirements, prevention of unsupported diagnoses and fabricated citations, input-order invariance, missing ≠ 0,
   and event counts never exceeding recorded events.
2. THE SYSTEM SHALL display uncertainty and observational-data limitation warnings on analysis pages.
