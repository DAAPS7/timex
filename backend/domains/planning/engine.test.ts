import { describe, expect, it } from 'vitest'
import type { Activity, CalendarEvent, PlanningInput } from '../../../shared/domain'
import { toMinutes } from '../../../shared/time'
import { computeAvailability, mergeIntervals, sumMinutes } from './availability'
import { generatePlan } from './engine'

const WEEK = '2026-09-14' // a Monday

const activity = (o: Partial<Activity> & { id: string }): Activity => ({
  name: o.id, sessionsPerWeek: 1, sessionMinutes: 60, priority: 'medium', preferredDays: [], ...o,
})
const event = (o: Partial<CalendarEvent> & { id: string }): CalendarEvent => ({
  title: o.id, date: WEEK, start: '09:00', end: '13:00', weekly: false, ...o,
})
const input = (o: Partial<PlanningInput> = {}): PlanningInput => ({
  today: WEEK, weekStart: WEEK, events: [], activities: [], goals: [],
  preferences: { timezone: 'Europe/Lisbon', dayStart: '08:00', dayEnd: '22:00', minBreakMinutes: 15, maxDailyPlannedMinutes: 480 },
  ...o,
})

describe('availability', () => {
  it('merges overlapping intervals', () => {
    expect(mergeIntervals([{ start: 60, end: 120 }, { start: 100, end: 180 }, { start: 200, end: 210 }])).toEqual([
      { start: 60, end: 180 }, { start: 200, end: 210 },
    ])
  })
  it('derives free time from waking hours minus events, and expands weekly events', () => {
    const free = computeAvailability(input({ events: [event({ id: 'uni', weekly: true })] }))
    expect(sumMinutes(free['2026-09-14'])).toBe(14 * 60 - 4 * 60)
    expect(sumMinutes(free['2026-09-21'] ?? [])).toBe(0) // outside the week
    expect(sumMinutes(free['2026-09-20'])).toBe(14 * 60) // Sunday: no event
  })
  it('makes days before today unavailable', () => {
    const free = computeAvailability(input({ today: '2026-09-16' }))
    expect(sumMinutes(free['2026-09-15'])).toBe(0)
    expect(sumMinutes(free['2026-09-16'])).toBeGreaterThan(0)
  })
})

describe('generatePlan', () => {
  it('is deterministic', () => {
    const i = input({ activities: [activity({ id: 'gym', sessionsPerWeek: 4 }), activity({ id: 'study', sessionsPerWeek: 3, sessionMinutes: 90 })] })
    expect(generatePlan(i)).toEqual(generatePlan(i))
  })

  it('never overlaps fixed events, other sessions, or the required break', () => {
    const i = input({
      events: [event({ id: 'uni', weekly: true }), event({ id: 'work', start: '14:00', end: '18:00', weekly: true })],
      activities: [activity({ id: 'gym', sessionsPerWeek: 4 }), activity({ id: 'study', sessionsPerWeek: 5, sessionMinutes: 90 })],
    })
    const r = generatePlan(i)
    expect(r.status).toBe('fully_feasible')
    for (const it of r.scheduledItems) {
      const [s, e] = [toMinutes(it.start), toMinutes(it.end)]
      expect(s).toBeGreaterThanOrEqual(toMinutes('08:00'))
      expect(e).toBeLessThanOrEqual(toMinutes('22:00'))
      for (const ev of i.events.filter((ev) => ev.date === it.date || (ev.weekly && new Date(ev.date).getUTCDay() === new Date(it.date).getUTCDay()))) {
        expect(s < toMinutes(ev.end) && e > toMinutes(ev.start)).toBe(false)
      }
    }
    const sameDay = r.scheduledItems.filter((x, idx, arr) => arr.some((y, j) => j !== idx && y.date === x.date))
    for (const a of sameDay) for (const b of sameDay) {
      if (a !== b && a.date === b.date && a.start < b.start) expect(toMinutes(b.start) - toMinutes(a.end)).toBeGreaterThanOrEqual(15)
    }
  })

  it('spreads sessions of one activity across different days', () => {
    const r = generatePlan(input({ activities: [activity({ id: 'gym', sessionsPerWeek: 4 })] }))
    expect(new Set(r.scheduledItems.map((x) => x.date)).size).toBe(4)
  })

  it('respects preferred time windows when possible', () => {
    const r = generatePlan(input({ activities: [activity({ id: 'gym', preferredStart: '17:00', preferredEnd: '21:00' })] }))
    const it = r.scheduledItems[0]
    expect(toMinutes(it.start)).toBeGreaterThanOrEqual(toMinutes('17:00'))
    expect(toMinutes(it.end)).toBeLessThanOrEqual(toMinutes('21:00'))
  })

  it('reports partial feasibility instead of inventing time', () => {
    const r = generatePlan(input({ activities: [activity({ id: 'study', sessionsPerWeek: 7, sessionMinutes: 240 })], preferences: { ...input().preferences, maxDailyPlannedMinutes: 240 } }))
    expect(r.scheduledMinutes).toBeLessThanOrEqual(7 * 240)
    const busyDay = generatePlan(input({ today: '2026-09-20', activities: [activity({ id: 'study', sessionsPerWeek: 6, sessionMinutes: 120 })] }))
    expect(busyDay.status).toBe('partially_feasible')
    expect(busyDay.conflicts[0].code).toBe('INSUFFICIENT_AVAILABLE_TIME')
    expect(busyDay.unscheduledMinutes).toBeGreaterThan(0)
  })

  it('enforces the daily workload cap', () => {
    const r = generatePlan(input({ today: '2026-09-20', preferences: { ...input().preferences, maxDailyPlannedMinutes: 120 }, activities: [activity({ id: 'study', sessionsPerWeek: 4, sessionMinutes: 60 })] }))
    expect(r.scheduledMinutes).toBe(120)
  })

  it('never schedules after a deadline and flags the conflict', () => {
    const r = generatePlan(input({ activities: [activity({ id: 'study', sessionsPerWeek: 6, sessionMinutes: 120, deadline: '2026-09-14' })] }))
    expect(r.scheduledItems.every((x) => x.date <= '2026-09-14')).toBe(true)
    expect(r.conflicts[0].code).toBe('DEADLINE_UNACHIEVABLE')
  })

  it('lets a high-priority goal claim scarce time first', () => {
    const r = generatePlan(input({
      today: '2026-09-20',
      goals: [{ id: 'g', title: 'Exam', deadline: '2026-09-20', priority: 'critical' }],
      activities: [activity({ id: 'game', sessionsPerWeek: 1, sessionMinutes: 600 }), activity({ id: 'study', goalId: 'g', sessionsPerWeek: 1, sessionMinutes: 600 })],
    }))
    expect(r.scheduledItems.map((x) => x.activityId)).toContain('study')
  })
})
