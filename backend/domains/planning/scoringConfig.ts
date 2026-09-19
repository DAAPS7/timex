// All scoring weights live here so the scoring model can be tuned or replaced in one place.
export const SCORING = {
  priority: { low: 0, medium: 5, high: 10, critical: 15 },
  preferredTime: 30, // scaled by the fraction of the slot inside the preferred window
  preferredDay: 15,
  deadlineUrgency: 25, // scaled by urgency (0..1) and by how early the slot is
  spread: 20, // reward for distance (up to 2 days) from other sessions of the same activity
  sameDayPenalty: 35, // per existing session of the same activity on that day
  contextSwitchPenalty: 12, // adjacent to a different activity
  workloadPenalty: 20, // scaled by planned/max daily load after placing
  inconveniencePenalty: 25, // scaled by the fraction of the slot outside comfortable hours
  comfortableStart: '08:00',
  comfortableEnd: '21:00',
  lightDayThreshold: 0.25, // planned/max below this counts as a "light day"
  deadlineHorizonDays: 14,
  slotStepMinutes: 15,
} as const
