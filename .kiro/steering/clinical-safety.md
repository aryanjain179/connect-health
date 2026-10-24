---
inclusion: always
---

# Clinical Safety Rules

These rules are non-negotiable for every feature, text string and test.

## Language

- Never claim causation from observational data. Use "associated with", "more seizures were recorded when…",
  "possible pattern". Never label a factor a "confirmed trigger".
- Never state or imply a diagnosis the patient does not have documented. Use "may warrant clinician review".
- Never output individual disease probabilities or risk percentages for a condition.
- Never recommend starting, stopping or changing a medication or dose.
- Medication analyses describe temporal associations only, never treatment effects.
- No cancer (or other disease) prediction from seizure patterns. Concerning new or changing symptoms route to the
  reviewed safety protocol (contact the treating clinician; emergency guidance for seizures ≥ 5 minutes, per CDC
  first-aid guidance and the ILAE status epilepticus definition).

## Data honesty

- Missing observations never count as zero or as "no symptom". Report them as missing and exclude them from
  denominators.
- Count seizure days (exposure units) separately from seizure events; event counts can never exceed recorded events.
- Report denominators, observation windows and comparison groups for every rate.
- Suppress findings when data are insufficient and say why.
- Clearly distinguish: confirmed diagnoses · patient-reported symptoms · population-level associations ·
  patient-specific calculated patterns · potential clinical hypotheses.

## Evidence

- Only cite sources stored in the curated knowledge base (`src/clinical/knowledgeBase.ts`), each with a verified
  PubMed/DOI or official public-health URL. Never fabricate or auto-generate citations.
- Each KB entry lists population, limitations, relevant signals and a clinician discussion point.
- A clinical connection is surfaced only when patient-specific signals exist. Epilepsy alone never triggers an
  ADHD-assessment suggestion.
- Any optional AI text must only restate validated calculations and supplied evidence (none is implemented in the
  prototype; the app works without an LLM).

## Workflow

- Care tasks are reminders for the patient. The app never orders tests, makes referrals, contacts providers or
  changes treatment.

## Review flags (ConnectHealth expansion)

- Red = rule backed by clinically reviewed guidance with a documented source (currently only seizure ≥ 5 minutes:
  CDC first aid, ILAE status epilepticus t1). Amber = prototype analytic rule (possible pattern / notable change);
  its thresholds are documented as prototype heuristics, never presented as validated clinical rules.
- Patient-facing wording: "Pattern identified for clinician review. A change or correlation was observed in your
  recorded health data during this period. The significance is uncertain. Please discuss this finding with a
  qualified healthcare professional." Never name or speculate about a disease.
- Insufficient data → "Insufficient data to assess this pattern", never a flag.

## Allergies

- No allergy records means "not recorded"; only an explicit "no known allergies" answer may be shown as none.
- Medication–allergy warnings are simple name matches and must say so; they are not a drug-safety check.

## Navigator, assistant, voice journal, sharing

- Specialty suggestions are "may be worth discussing", never "medically necessary"; coverage and referral rules are
  never invented – users are told to confirm with their insurer or clinician.
- The assistant answers only from stored records, analysis results and the curated KB, lists sources and missing
  data, declines diagnosis/prescribing requests and gives emergency guidance for emergency wording.
- Voice journal: nothing is written without explicit approval; no invented doses, dates or severity; ambiguous
  details trigger clarification; no tone/emotion analysis.
- Never imply that information was sent to a clinician, insurer or caregiver. Sharing is a local preview only.
