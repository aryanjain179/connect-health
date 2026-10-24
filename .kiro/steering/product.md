---
inclusion: always
---

# HealthConnect – Product Scope

HealthConnect is a Patient Health Intelligence Platform. It helps patients, clinicians and researchers understand
longitudinal health data by connecting seizure events with sleep, menstrual-cycle timing, medications, other
symptoms and curated clinical evidence.

## Initial scope (prototype)

- Condition focus: epilepsy. The architecture (models, analysis engine, knowledge base) must stay condition-agnostic
  where reasonable so other chronic conditions can be added later (e.g. new `conditionFocus`, new KB entries,
  new analysis modules) without rewriting the UI shell.
- Single fictional patient, ~90 days of synthetic data, stored in browser `localStorage`.
- Runs fully offline after `npm install`: no paid database, no external health API, no AI/LLM API key.

## Primary users

- Patients: log seizures, daily observations, cycles, medications and symptoms; prepare for appointments.
- Clinicians: review longitudinal data, calculated personal patterns and evidence-informed connections.
- Researchers: inspect methods, denominators and limitations of each calculation.

## Core features (sidebar order)

1. Overview
2. Health Timeline
3. Pattern Discovery (deterministic personal-pattern engine – the differentiating feature)
4. Clinical Connections (curated knowledge base, surfaced only with patient-specific reasons)
5. Clinician Summary (generated from current data; copy / download / print)
6. Care Tasks (lightweight follow-up workflow)
7. Records (data entry: add / edit / delete, import / export / reset)

## Explicitly out of scope

- Diagnosis, individual disease-probability estimates, medication recommendations.
- Cancer (or any disease) prediction from seizure patterns.
- Automatic test ordering, referrals, provider contact or treatment changes.
- Real patient data, accounts, authentication or cloud sync.
