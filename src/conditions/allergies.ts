/** Starter allergen list for quick selection, and helpers. Not exhaustive; anything can be typed in. */
import type { AllergyCategory, AllergyRecord, AllergySeverity, ISODate, Medication } from '../models/types';

export const COMMON_ALLERGENS: Array<{ substance: string; category: AllergyCategory }> = [
  { substance: 'Penicillin', category: 'medication' },
  { substance: 'Sulfa drugs', category: 'medication' },
  { substance: 'Aspirin / NSAIDs', category: 'medication' },
  { substance: 'Codeine / opioids', category: 'medication' },
  { substance: 'Peanuts', category: 'food' },
  { substance: 'Tree nuts', category: 'food' },
  { substance: 'Shellfish', category: 'food' },
  { substance: 'Eggs', category: 'food' },
  { substance: 'Milk', category: 'food' },
  { substance: 'Wheat / gluten', category: 'food' },
  { substance: 'Pollen', category: 'environmental' },
  { substance: 'Dust mites', category: 'environmental' },
  { substance: 'Pet dander', category: 'environmental' },
  { substance: 'Mould', category: 'environmental' },
  { substance: 'Bee / wasp stings', category: 'insect' },
  { substance: 'Latex', category: 'latex' },
];

export const SEVERITY_LABELS: Record<AllergySeverity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
  unknown: 'Not sure',
};

export interface AllergyDraft {
  id: string;
  substance: string;
  category: AllergyCategory;
  reaction: string;
  severity: AllergySeverity;
}

export function draftsToAllergies(drafts: AllergyDraft[], today: ISODate): AllergyRecord[] {
  return drafts
    .filter((d) => d.substance.trim())
    .map((d, i) => ({
      id: `al-user-${i + 1}`,
      substance: d.substance.trim().slice(0, 80),
      category: d.category,
      reaction: d.reaction.trim().slice(0, 200),
      severity: d.severity,
      status: 'patient-reported',
      source: 'patient-reported',
      notedOn: today,
      notes: 'Added during onboarding.',
      isSynthetic: false,
    }));
}

/** Active medication-category allergies whose substance appears in a medication name (simple text match). */
export function allergyMatchesMedication(allergies: AllergyRecord[], medicationName: string): AllergyRecord[] {
  const name = medicationName.trim().toLowerCase();
  if (name.length < 3) return [];
  return allergies.filter((a) => {
    if (a.status === 'resolved' || a.category !== 'medication') return false;
    const terms = a.substance.toLowerCase().split(/[\s/,]+/).filter((t) => t.length >= 4);
    return terms.some((t) => name.includes(t) || t.includes(name));
  });
}

export function medicationAllergyWarnings(allergies: AllergyRecord[], meds: Medication[]): Array<{ med: Medication; allergy: AllergyRecord }> {
  return meds.flatMap((m) => allergyMatchesMedication(allergies, m.name).map((a) => ({ med: m, allergy: a })));
}

export function describeAllergy(a: AllergyRecord): string {
  return `${a.substance}${a.reaction ? ` – ${a.reaction}` : ''}${a.severity !== 'unknown' ? ` (${a.severity})` : ''}`;
}
