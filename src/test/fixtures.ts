/** Small hand-built fixtures for unit tests. All fictional. */
import type { DailyObservation, HealthData, SeizureEvent } from '../models/types';

export function obs(date: string, partial: Partial<DailyObservation> = {}): DailyObservation {
  return {
    id: `o-${date}`,
    date,
    sleepHours: 7,
    sleepQuality: 3,
    stressLevel: 3,
    illness: false,
    headache: false,
    dizziness: false,
    attentionDifficulty: false,
    otherSymptoms: [],
    notes: '',
    isSynthetic: true,
    ...partial,
  };
}

let szCounter = 0;
export function sz(date: string, partial: Partial<SeizureEvent> = {}): SeizureEvent {
  szCounter++;
  return {
    id: `s-${date}-${szCounter}`,
    date,
    time: '12:00',
    type: 'focal-impaired-awareness',
    durationSeconds: 60,
    severity: 'moderate',
    preSymptoms: [],
    postSymptoms: [],
    recoveryMinutes: 10,
    notes: '',
    isSynthetic: true,
    ...partial,
  };
}

export function emptyData(partial: Partial<HealthData> = {}): HealthData {
  return {
    profile: {
      id: 'p-test',
      displayName: 'Test patient (synthetic)',
      age: 30,
      sex: 'female',
      conditionFocus: 'epilepsy',
      isSynthetic: true,
    },
    seizures: [],
    observations: [],
    menstrual: [],
    medications: [],
    medicationEvents: [],
    history: [],
    tasks: [],
    ...partial,
  };
}
