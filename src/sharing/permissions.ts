/**
 * Granular sharing permissions for the local "Preview Shared View".
 *
 * The shared view is computed from `filterDataForPermissions(...)`, so data outside the granted permissions is not
 * present at all – not merely hidden. Derived insights and reports are recalculated from the filtered data, so they
 * cannot reveal restricted categories either. Journal transcripts and sharing settings are never shared.
 *
 * This is a local prototype: no invitation is sent and no remote access exists.
 */
import type { HealthData, PermissionKey, SharedPerson } from '../models/types';
import { emptyNavigator } from '../models/types';

export const PERMISSIONS: Array<{ key: PermissionKey; label: string; description: string }> = [
  { key: 'profile', label: 'Health profile and documented conditions', description: 'Name, age, sex, diagnosed and suspected conditions, allergies, medical history and referrals.' },
  { key: 'symptoms', label: 'Symptoms and daily journal', description: 'Daily check-in answers other than sleep (stress, headache, dizziness, illness, attention, other symptoms, notes) and reported symptoms. Journal transcripts are never shared.' },
  { key: 'events', label: 'Seizure or other event history', description: 'Every recorded seizure/event with date, time, type, duration and notes.' },
  { key: 'medications', label: 'Medications and treatment history', description: 'Current and past medications, dose changes, missed doses and side-effect reports.' },
  { key: 'sleep', label: 'Sleep and wearable-derived observations', description: 'Sleep duration and quality from daily check-ins.' },
  { key: 'menstrual', label: 'Menstrual-cycle data', description: 'Period dates, daily menstrual-bleeding answers and calculated cycle phases.' },
  { key: 'insights', label: 'Pattern insights and graphs', description: 'Calculated patterns, review flags and charts – computed only from the categories you also share.' },
  { key: 'reports', label: 'Clinician reports and PDF exports', description: 'The clinician summary and its PDF – built only from the categories you also share.' },
  { key: 'tasks', label: 'Care tasks and navigation notes', description: 'Care tasks, the next-step pathway, insurance checklist and contact log.' },
];

export function noPermissions(): Record<PermissionKey, boolean> {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])) as Record<PermissionKey, boolean>;
}

export function allPermissions(): Record<PermissionKey, boolean> {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])) as Record<PermissionKey, boolean>;
}

/** Access exists only for confirmed, non-revoked people with at least one permission. */
export function hasAccess(p: SharedPerson | undefined): p is SharedPerson {
  return !!p && p.status === 'active' && Object.values(p.permissions).some(Boolean);
}

/** Daily bleeding answers belong to the menstrual-cycle category, not symptoms. */
function withoutBleeding(m: Record<string, number | boolean | null> | undefined, keep: boolean) {
  if (!m || keep || !('menstrual-bleeding' in m)) return m;
  const { ['menstrual-bleeding']: _drop, ...rest } = m;
  return rest;
}

export function filterDataForPermissions(data: HealthData, perms: Record<PermissionKey, boolean>): HealthData {
  const obsAllowed = perms.sleep || perms.symptoms || perms.menstrual;
  return {
    profile: {
      id: data.profile.id,
      displayName: perms.profile ? data.profile.displayName : 'Name not shared',
      preferredName: perms.profile ? data.profile.preferredName : undefined,
      age: perms.profile ? data.profile.age : 0,
      dateOfBirth: null,
      sex: perms.profile ? data.profile.sex : 'unspecified',
      genderIdentity: perms.profile ? data.profile.genderIdentity : undefined,
      pronouns: perms.profile ? data.profile.pronouns : undefined,
      conditionFocus: perms.profile ? data.profile.conditionFocus : '',
      noKnownAllergies: perms.profile ? data.profile.noKnownAllergies : undefined,
      goals: [],
      trackers: { seizures: perms.events && !!data.profile.trackers?.seizures, menstrual: perms.menstrual && !!data.profile.trackers?.menstrual },
      careTeam: perms.tasks ? data.profile.careTeam : [],
      isSynthetic: data.profile.isSynthetic,
    },
    seizures: perms.events ? data.seizures : [],
    observations: obsAllowed
      ? data.observations.map((o) => ({
          ...o,
          sleepHours: perms.sleep ? o.sleepHours : null,
          sleepQuality: perms.sleep ? o.sleepQuality : null,
          stressLevel: perms.symptoms ? o.stressLevel : null,
          illness: perms.symptoms ? o.illness : null,
          headache: perms.symptoms ? o.headache : null,
          dizziness: perms.symptoms ? o.dizziness : null,
          attentionDifficulty: perms.symptoms ? o.attentionDifficulty : null,
          otherSymptoms: perms.symptoms ? o.otherSymptoms : [],
          // Condition-specific measures (pain, mood, blood pressure…) are part of the symptoms category.
          measures: perms.symptoms ? withoutBleeding(o.measures, perms.menstrual) : perms.menstrual && o.measures?.['menstrual-bleeding'] !== undefined ? { 'menstrual-bleeding': o.measures['menstrual-bleeding'] } : undefined,
          notes: perms.symptoms ? o.notes : '',
        }))
      : [],
    menstrual: perms.menstrual ? data.menstrual : [],
    medications: perms.medications ? data.medications : [],
    medicationEvents: perms.medications ? data.medicationEvents : [],
    history: data.history.filter((h) => (h.kind === 'symptom' ? perms.symptoms : perms.profile)),
    tasks: perms.tasks ? data.tasks : [],
    // Allergies are part of the health profile.
    allergies: perms.profile ? data.allergies : [],
    journal: [],
    sharing: [],
    navigator: perms.tasks ? data.navigator : emptyNavigator(),
    reviewExcluded: data.reviewExcluded,
  };
}
