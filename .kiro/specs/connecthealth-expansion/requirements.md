# Requirements – ConnectHealth expansion

Extends the original epilepsy prototype (spec `../connecthealth/`) into **ConnectHealth**, a condition-agnostic health
intelligence and navigation platform. Existing features, the synthetic demo patient and the analysis engine are
preserved. EARS notation.

## E1 – Welcome and onboarding
1. WHEN no profile is active THE SYSTEM SHALL show a welcome screen with the ConnectHealth logo, the tagline
   "Your health information, connected. Your next steps, clearer.", "Create My Health Profile", "Explore Demo
   Patient" and a local-storage / synthetic-data privacy note.
2. THE SYSTEM SHALL provide a 4-step onboarding (About you · Conditions · Goals · Review) with a progress indicator.
3. Step 1 SHALL require a name and an age or date of birth; sex options SHALL include female, male, intersex and
   prefer not to say; gender identity, pronouns and preferred name SHALL be optional and separate from sex.
4. Step 2 SHALL offer a searchable, categorised, multi-select condition library with expandable categories, a
   selected count, custom conditions, a diagnosed / suspected / symptom distinction, a "No known diagnosed
   conditions" option that is mutually exclusive with diagnosed selections, and "Skip for now".
5. Step 3 SHALL offer multi-select health goals. Step 4 SHALL summarise entries, allow editing earlier steps and
   save the profile.
6. THE SYSTEM SHALL validate required fields with readable errors, save draft progress locally, and keep the
   demo patient separate from the user profile.
7. THE SYSTEM SHALL NOT infer a diagnosis from a symptom or goal.

## E2 – Condition-agnostic product
1. Labels, navigation and dashboard SHALL be personalised from the profile's conditions, goals and trackers.
2. Seizure and menstrual-cycle tracking SHALL be optional modules, shown only when enabled or when data exist.
3. Pattern analyses SHALL support multiple outcomes (seizures and recorded daily symptoms) and explain when an
   outcome cannot be analysed (e.g. free-text symptoms whose absence is not recorded).

## E3 – Clinician review flags and report
1. THE SYSTEM SHALL derive review flags from findings using documented rules: **red** only for rules based on
   clinically reviewed guidance (seizure ≥ 5 minutes, CDC / ILAE); **amber** for prototype analytic rules
   (possible patterns, notable changes). Insufficient data SHALL display "Insufficient data to assess this pattern".
2. Charts SHALL show clickable markers at the involved dates with a legend; the explanation SHALL list dates,
   observation window, comparison, counts, missing data, a timeline link and an include-in-report toggle.
3. Patient-facing text SHALL use the neutral "Pattern identified for clinician review" wording and never name a
   disease.
4. A Clinician Review report SHALL consolidate flags, charts, counts, missing data, timeline links and questions,
   labelled as decision support, not a diagnosis.

## E4 – Care Navigator
1. THE SYSTEM SHALL suggest specialties/services from conditions, symptoms, care team and flags, each with reasons,
   informing data, uncertainty, a question to ask and referral notes, never claiming medical necessity.
2. THE SYSTEM SHALL provide a 7-step pathway marking generic vs personalised guidance, an insurance checklist,
   insurer details, a contact log, and copyable templates with editable placeholders.
3. Users SHALL add next steps as tasks with statuses started / waiting / completed / blocked, contact details,
   follow-up dates, notes and links. THE SYSTEM SHALL NOT claim any call, referral or verification occurred unless
   the user recorded it.

## E5 – Ask My Health Data
1. A chat interface SHALL answer supported questions from stored records, analysis results and the curated KB,
   listing sources (dates, records, report sections), missing information and suggested clinician questions.
2. Unsupported questions SHALL receive an explicit "cannot answer from your data" response. Diagnosis or
   prescribing requests SHALL be declined; emergency wording SHALL return emergency guidance.
3. THE SYSTEM SHALL label it a rule-based prototype assistant and SHALL NOT claim an AI model is connected.

## E6 – Voice Journal
1. THE SYSTEM SHALL record speech with browser speech recognition when available, with visible recording state and
   transparent permission handling, and SHALL offer a manual text fallback.
2. A deterministic extractor SHALL propose structured entries with the supporting phrase; ambiguous details SHALL
   prompt clarification; nothing is invented.
3. Only user-approved (optionally edited) proposals SHALL be written; transcripts are saved only if the user opts in;
   users can delete a journal entry and revert the records it created.

## E7 – PDF export
1. Reports SHALL be exportable as a generated PDF (client-side, no paid service) and via Print / Save as PDF.
2. The PDF SHALL include title, patient display name, generation date, period, conditions, medications, key timeline
   events, patterns, review flags with chart markers, completeness, unconfirmed connections, questions, tasks and a
   not-a-diagnosis disclaimer, with page-break handling. It SHALL reflect current data.

## E8 – People & Data Sharing
1. Users SHALL add people (name, relationship, optional contact, role) with sharing off by default, granular
   permissions with select-all, confirm and revoke.
2. Permissions SHALL be enforced in a Preview Shared View built from filtered data; restricted data SHALL be absent.
3. THE SYSTEM SHALL state that no invitation is sent and that real sharing needs a secure backend.

## E10 – Condition-driven daily check-in
1. THE SYSTEM SHALL log seizures inside the daily check-in and SHALL show the seizure log only when epilepsy is among
   the selected conditions (any status) or seizures are already recorded; there SHALL be no separate "Log seizure"
   entry point.
2. THE SYSTEM SHALL add condition-specific check-in questions for other selected conditions, keep answered questions
   visible, and offer "show all optional questions".
3. Logging only a seizure SHALL NOT create an empty check-in record.
4. WHEN cycle tracking is on THE SYSTEM SHALL ask "Menstrual bleeding on this day?" (yes / no / not recorded) and SHALL
   derive period records from consecutive bleeding days rather than asking for a period start.

## E11 – Allergies and dated cycle timeline
1. Onboarding SHALL include an allergies step (quick picks, custom entries, reaction, severity, "no known allergies"
   mutually exclusive with entries, skip = not recorded); allergies SHALL be editable in Records and shown on the
   Overview, clinician report/PDF, shared view (profile permission) and assistant.
2. THE SYSTEM SHALL show a name-match notice when a medication matches a recorded medication allergy.
3. The menstrual-cycle strip SHALL show dated period-start labels, a weekly date axis, a hover/focus detail line and a
   dated list of period starts and events.

## E9 – Integration
All pages SHALL share one profile and data model; journal approvals, edits and deletions SHALL update every view;
tasks SHALL be creatable from findings, flags and navigator suggestions.
