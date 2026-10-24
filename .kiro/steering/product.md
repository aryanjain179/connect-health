---
inclusion: always
---

# ConnectHealth – Product Scope

ConnectHealth is a patient-centred health intelligence and navigation platform.
It helps people bring their health information together, recognise potentially meaningful patterns, prepare for
appointments, understand possible next steps and navigate the healthcare system.

## Scope

- **Condition-agnostic.** Users select any conditions from a starter catalog (or add their own). Epilepsy is one
  condition in the library and the condition of the synthetic demo patient – never a default assumption.
- The daily check-in is condition-driven: core questions for everyone, plus questions for the selected conditions.
  The seizure log is part of the check-in and appears only when epilepsy is selected (or seizures already exist).
  Menstrual tracking is an opt-in tracker.
- Two separate local profiles: the synthetic **demo patient** and the user's **own profile** (created in onboarding).
- Runs fully offline after `npm install`: no paid services, API keys, accounts or backend.

## Core journey

Sign up → select conditions and goals → record health information (forms or Voice Journal) → discover patterns →
review flagged findings → ask questions → explore care-navigation next steps → generate a report → share selected
information with a trusted person (local preview).

## Navigation

Understand: Overview, Health Timeline, Pattern Discovery, Clinician Review, Clinical Connections.
Act: Ask My Health Data, Voice Journal, Care Navigator, Care Tasks, Clinician Summary.
Manage: Records, Settings (profile, trackers, People & Data Sharing).

## Out of scope

- Diagnosis, disease prediction (including cancer), individual risk estimates, medication recommendations.
- Ordering tests, making referrals, contacting providers/insurers/caregivers, verifying coverage.
- Real authentication, invitations, remote access or secure PHI storage (localStorage is not secure storage).
- External AI models (the assistant is rule-based and labelled as a prototype).
