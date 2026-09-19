import type { Preferences } from './domain'
import { toMinutes } from './time'

type Waking = Pick<Preferences, 'dayStart' | 'dayEnd'>

/**
 * The window in which activities can be planned, in minutes from midnight. A bedtime at or before the wake-up time
 * (e.g. 00:30) means the user sleeps after midnight, so planning simply runs until the end of the day.
 */
export function wakingWindow(p: Waking): { start: number; end: number } {
  const start = toMinutes(p.dayStart)
  const end = toMinutes(p.dayEnd)
  return { start, end: end > start ? end : 1440 }
}

/** Minutes of sleep between bedtime and wake-up time. */
export function sleepMinutes(p: Waking): number {
  const start = toMinutes(p.dayStart)
  const end = toMinutes(p.dayEnd)
  return end > start ? 1440 - (end - start) : start - end
}
