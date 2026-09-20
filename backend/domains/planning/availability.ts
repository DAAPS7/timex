import { occursOn } from '../../../shared/events'
import { wakingWindow } from '../../../shared/routine'
import { toHHMM, toMinutes, weekDates } from '../../../shared/time'
import type { CalendarEvent, CommuteBlock, PlanningInput, Warning } from '../../../shared/domain'

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
 * Commute time: on days with recurring (fixed) commitments, half of the daily transport time is reserved right
 * before the first one and the other half right after the last one, kept inside waking hours.
 */
export function computeCommute(input: PlanningInput, dates: string[]): CommuteBlock[] {
  const { commute, dayStart, dayEnd } = input.preferences
  if (!commute || commute.minutesPerDay <= 0) return []
  const { start: wake, end: bed } = wakingWindow({ dayStart, dayEnd })
  const blocks: CommuteBlock[] = []
  for (const date of dates) {
    if (date < input.today) continue
    const fixed = input.events.filter((e) => e.weekly && occursOn(e, date))
    if (fixed.length === 0) continue
    const first = Math.min(...fixed.map((e) => toMinutes(e.start)))
    const last = Math.max(...fixed.map((e) => toMinutes(e.end)))
    const before = Math.ceil(commute.minutesPerDay / 2)
    const after = commute.minutesPerDay - before
    const go = { start: Math.max(wake, first - before), end: first }
    const back = { start: last, end: Math.min(bed, last + after) }
    for (const b of [go, back]) {
      if (b.end > b.start) blocks.push({ date, start: toHHMM(b.start), end: toHHMM(b.end), modes: commute.modes })
    }
  }
  return blocks
}

/**
 * Availability is derived, never stored: waking hours minus fixed events and commute time.
 * Days before `today` are unavailable (nothing is planned in the past), and so is the part of today before `nowMinutes`.
 */
export function computeAvailability(input: PlanningInput, commute: CommuteBlock[] = computeCommute(input, weekDates(input.weekStart))): DayIntervals {
  const { weekStart, today, events, preferences, nowMinutes } = input
  const dates = weekDates(weekStart)
  const busy = expandEvents(events, dates)
  for (const b of commute) busy[b.date].push({ start: toMinutes(b.start), end: toMinutes(b.end) })
  // Time that already went by today is gone.
  if (nowMinutes !== undefined && busy[today]) busy[today].push({ start: 0, end: nowMinutes })
  const waking: Interval = wakingWindow(preferences)
  const free: DayIntervals = {}
  for (const date of dates) {
    free[date] = date < today || waking.end <= waking.start ? [] : subtractIntervals([waking], busy[date])
  }
  return free
}
