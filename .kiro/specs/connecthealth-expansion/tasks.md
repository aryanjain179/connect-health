# Tasks – ConnectHealth expansion

Each stage ends with `npm test` and `npm run build` passing.

## Stage A – Foundations (priority 1)
- [x] A1 Extend models; condition catalog. _E1, E2_
- [x] A2 Root storage v2 with v1 migration; profile-scoped provider. _E1.6_
- [x] A3 Welcome screen and 4-step onboarding with draft persistence and validation. _E1_
- [x] A4 Rebrand to ConnectHealth; personalised navigation, dashboard and trackers. _E2.1–E2.2_
- [x] A5 Settings: edit profile, trackers, switch profile / sign out. _E1_
- [x] A6 Tests: storage migration, onboarding conversion, condition exclusivity. _E1_

## Stage B – Analysis outcomes and review flags (priority 2)
- [x] B1 Multi-outcome analysis context and wording. _E2.3_
- [x] B2 Review flags with documented rules; chart markers with legend and detail dialog. _E3.1–E3.3_
- [x] B3 Clinician Review page; timeline and summary integration. _E3.4_
- [x] B4 PDF report (jsPDF) and print fallback. _E7_
- [x] B5 Tests: flag rules, insufficient data, PDF content. _E3, E7_

## Stage C – Care Navigator (priority 3)
- [x] C1 Specialty suggestions, pathway, insurance checklist, contact log, templates. _E4.1–E4.2_
- [x] C2 Extended task statuses/fields; tasks from findings, flags and suggestions. _E4.3_
- [x] C3 Tests: suggestion rules and safe wording. _E4_

## Stage D – Ask and Voice Journal (priority 4)
- [x] D1 Rule-based assistant with sources and safety intents. _E5_
- [x] D2 Voice journal: speech hook, extractor, review/approve, undo. _E6_
- [x] D3 Tests: assistant grounding, extractor (negation, numbers, no invention), apply/undo. _E5, E6_

## Stage E – Sharing (priority 5)
- [x] E1 People & Data Sharing settings; preview shared view with enforced filtering. _E8_
- [x] E2 Tests: permission filtering and revoke. _E8_

## Stage G – Condition-driven check-in (follow-up request)
- [x] G1 Rename ComorbidIQ → ConnectHealth across UI, code, docs and Kiro artifacts.
- [x] G2 Check-in registry: seizure log for epilepsy only; condition questions and measures. _E10_
- [x] G3 Check-in form with inline seizure log, condition section, period start; remove "Log seizure" buttons. _E10_
- [x] G4 Yes/no measures as outcomes; measures in timeline, records, summary and sharing filter. _E10_
- [x] G5 Tests for plan, validation, outcomes, sharing and UI flows. _E10_
- [x] G6 Replace “period started” with a daily menstrual-bleeding question that maintains period records (check-in and voice journal). _E10.4_

## Stage H – Allergies and dated cycle strip (follow-up request)
- [x] H1 Allergy model, onboarding step, Records tab, form and validation. _E11.1_
- [x] H2 Allergies in Overview, report/PDF, shared view, assistant; medication name-match notice. _E11.1–E11.2_
- [x] H3 Cycle strip: period-start labels, weekly dates, detail line, dated list. _E11.3_
- [x] H4 Tests. _E11_

## Stage I – Make recording today prominent (follow-up request)
- [x] I1 Overview “How are you today?” card with voice and form options and today’s status.
- [x] I2 Sidebar “Record today” block, stronger header buttons with reminder dot, phone bottom bar.
- [x] I3 Cross-links between check-in form and voice journal; UI test.

## Stage F – Integration
- [x] F1 UI journey test: onboard → record → patterns → review → ask → navigate → report → share. _E9_
- [x] F2 Docs, README, steering updates; browser check on desktop and phone widths.
