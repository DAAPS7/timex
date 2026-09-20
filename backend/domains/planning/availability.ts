import { occursOn } from '../../../shared/events'
import { wakingWindow } from '../../../shared/routine'
import { toHHMM, toMinutes, weekDates } from '../../../shared/time'
import type { CalendarEvent, CommuteBlock, EssentialBlock, PlanningInput, Warning } from '../../../shared/domain'

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
      // overlapping on purpose (an event marked as allowing other things) is not a mistake
      if (day[i].start < day[i - 1].end && !day[i].canOverlap && !day[i - 1].canOverlap) {
        warnings.push({ code: 'OVERLAPPING_EVENTS', detail: `${day[i - 1].title} / ${day[i].title} (${date})` })
      }
    }
  }
  return warnings
}

/**
 * Commute time: on days with recurring (fixed) in-person commitments (remote ones need no travel), half of the daily transport time is reserved right
 * before the first one and the other half right after the last one, kept inside waking hours.
 */
export function computeCommute(input: PlanningInput, dates: string[]): CommuteBlock[] {
  const { commute, dayStart, dayEnd } = input.preferences
  if (!commute || commute.minutesPerDay <= 0) return []
  const { start: wake, end: bed } = wakingWindow({ dayStart, dayEnd })
  const blocks: CommuteBlock[] = []
  for (const date of dates) {
    if (date < input.today) continue
    // travel placed by the user on this day replaces the automatic estimate
    if (input.events.some((e) => e.kind === 'travel' && occursOn(e, date))) continue
    const fixed = input.events.filter((e) => e.weekly && !e.remote && e.kind !== 'travel' && occursOn(e, date))
    if (fixed.length === 0) continue
    const first = Math.min(...fixed.map((e) => toMinutes(e.start)))
    const last = Math.max(...fixed.map((e) => toMinutes(e.end)))
    const before = Math.ceil(commute.minutesPerDay / 2)
    const after = commute.minutesPerDay - before
    const go = { start: Math.max(wake, first - before), end: first }
    const back = { start: last, end: Math.min(bed, last + after) }
    for (const b of [go, back]) {
      if (b.end > b.start) blocks.push({ date, start: toHHMM(b.start), end: toHHMM(b.end), modes: commute.modes, overlappable: commute.modes.every((m) => m === 'bus' || m === 'train') })
    }
  }
  return blocks
}

/**
 * Time that is busy but where other things can still be done: travel by bus/train and events marked "allows other
 * things". Only activities that can be done at the same time may be placed here.
 */
export interface OverlapSlot extends Interval {
  date: string
  source: string // normalized title of the event it comes from, or TRAVEL_SOURCE for automatic transport
}

export const TRAVEL_SOURCE = 'transporte'

/** Lowercase, no accents: "Aulas de Investigação" matches "aulas de investigacao". */
export const normalizeTitle = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()

/** Whether an activity's `overlapWith` list allows the slot (an empty list allows any). */
export const overlapAllowed = (overlapWith: string[] | undefined, slot: OverlapSlot): boolean =>
  !overlapWith || overlapWith.length === 0 ||
  overlapWith.some((w) => {
    const t = normalizeTitle(w)
    return slot.source.includes(t) || t.includes(slot.source)
  })

export function computeOverlapSlots(input: PlanningInput, dates: string[], commute: CommuteBlock[]): OverlapSlot[] {
  const slots: OverlapSlot[] = []
  for (const date of dates) {
    if (date < input.today) continue
    const gone = date === input.today && input.nowMinutes !== undefined ? [{ start: 0, end: input.nowMinutes }] : []
    const raw: OverlapSlot[] = [
      ...input.events
        .filter((e) => e.canOverlap && occursOn(e, date))
        .map((e) => ({ date, source: normalizeTitle(e.title), start: toMinutes(e.start), end: toMinutes(e.end) })),
      ...commute
        .filter((b) => b.date === date && b.overlappable)
        .map((b) => ({ date, source: TRAVEL_SOURCE, start: toMinutes(b.start), end: toMinutes(b.end) })),
    ]
    for (const s of raw) for (const iv of subtractIntervals([s], gone)) slots.push({ ...s, ...iv })
  }
  return slots
}

/** The slots as free intervals per day (merged). */
export function slotsToIntervals(slots: OverlapSlot[], dates: string[]): DayIntervals {
  return Object.fromEntries(dates.map((d) => [d, mergeIntervals(slots.filter((s) => s.date === d).map(({ start, end }) => ({ start, end })))]))
}

/**
 * Essentials (meals, etc.) are layered on top of free time: each daily block is kept only where it is not already taken
 * by a fixed event or travel, and only inside waking hours.
 */
export function computeEssentials(input: PlanningInput, dates: string[], commute: CommuteBlock[]): EssentialBlock[] {
  const { essentials = [], dayStart, dayEnd } = input.preferences
  if (essentials.length === 0) return []
  const waking = wakingWindow({ dayStart, dayEnd })
  const busy = expandEvents(input.events, dates)
  for (const b of commute) busy[b.date].push({ start: toMinutes(b.start), end: toMinutes(b.end) })
  const blocks: EssentialBlock[] = []
  for (const date of dates) {
    if (date < input.today) continue
    for (const e of essentials) {
      const wanted: Interval = { start: Math.max(toMinutes(e.start), waking.start), end: Math.min(toMinutes(e.end), waking.end) }
      if (wanted.end <= wanted.start) continue
      for (const iv of subtractIntervals([wanted], busy[date])) {
        blocks.push({ date, start: toHHMM(iv.start), end: toHHMM(iv.end), title: e.title, kind: e.kind })
      }
    }
  }
  return blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}

/**
 * Availability is derived, never stored: waking hours minus fixed events, then travel and essentials on top.
 * Days before `today` are unavailable (nothing is planned in the past), and so is the part of today before `nowMinutes`.
 */
export function computeAvailability(
  input: PlanningInput,
  commute: CommuteBlock[] = computeCommute(input, weekDates(input.weekStart)),
  essentials: EssentialBlock[] = computeEssentials(input, weekDates(input.weekStart), commute),
): DayIntervals {
  const { weekStart, today, events, preferences, nowMinutes } = input
  const dates = weekDates(weekStart)
  const busy = expandEvents(events, dates)
  for (const b of [...commute, ...essentials]) busy[b.date].push({ start: toMinutes(b.start), end: toMinutes(b.end) })
  // Time that already went by today is gone.
  if (nowMinutes !== undefined && busy[today]) busy[today].push({ start: 0, end: nowMinutes })
  const waking: Interval = wakingWindow(preferences)
  const free: DayIntervals = {}
  for (const date of dates) {
    free[date] = date < today || waking.end <= waking.start ? [] : subtractIntervals([waking], busy[date])
  }
  return free
}
