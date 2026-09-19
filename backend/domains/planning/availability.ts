import { occursOn } from '../../../shared/events'
import { toMinutes, weekDates } from '../../../shared/time'
import type { CalendarEvent, PlanningInput, Warning } from '../../../shared/domain'

export interface Interval {
  start: number // minutes from midnight
  end: number
}

export type DayIntervals = Record<string, Interval[]>

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end)
    else out.push({ ...iv })
  }
  return out
}

/** Remove `blocked` from `base`. Both are treated as sets of time. */
export function subtractIntervals(base: Interval[], blocked: Interval[]): Interval[] {
  const merged = mergeIntervals(blocked)
  const out: Interval[] = []
  for (const iv of base) {
    let cursor = iv.start
    for (const b of merged) {
      if (b.end <= cursor || b.start >= iv.end) continue
      if (b.start > cursor) out.push({ start: cursor, end: b.start })
      cursor = Math.max(cursor, b.end)
    }
    if (cursor < iv.end) out.push({ start: cursor, end: iv.end })
  }
  return out
}

export const sumMinutes = (intervals: Interval[]): number => intervals.reduce((n, iv) => n + (iv.end - iv.start), 0)

/** Expand (possibly recurring) events into concrete busy intervals for each day of the week. */
export function expandEvents(events: CalendarEvent[], dates: string[]): DayIntervals {
  const byDay: DayIntervals = {}
  for (const date of dates) {
    byDay[date] = events
      .filter((e) => occursOn(e, date))
      .map((e) => ({ start: toMinutes(e.start), end: toMinutes(e.end) }))
  }
  return byDay
}

export function detectOverlappingEvents(events: CalendarEvent[], dates: string[]): Warning[] {
  const warnings: Warning[] = []
  for (const date of dates) {
    const day = events
      .filter((e) => occursOn(e, date))
      .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    for (let i = 1; i < day.length; i++) {
      if (day[i].start < day[i - 1].end) {
        warnings.push({ code: 'OVERLAPPING_EVENTS', detail: `${day[i - 1].title} / ${day[i].title} (${date})` })
      }
    }
  }
  return warnings
}

/**
 * Availability is derived, never stored: waking hours minus fixed events.
 * Days before `today` are unavailable (nothing is planned in the past).
 */
export function computeAvailability(input: PlanningInput): DayIntervals {
  const { weekStart, today, events, preferences } = input
  const dates = weekDates(weekStart)
  const busy = expandEvents(events, dates)
  const waking: Interval = { start: toMinutes(preferences.dayStart), end: toMinutes(preferences.dayEnd) }
  const free: DayIntervals = {}
  for (const date of dates) {
    free[date] = date < today || waking.end <= waking.start ? [] : subtractIntervals([waking], busy[date])
  }
  return free
}

