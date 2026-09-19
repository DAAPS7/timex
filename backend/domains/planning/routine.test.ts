import { describe, expect, it } from 'vitest'
import type { Activity, CalendarEvent, PlanningInput } from '../../../shared/domain'
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

describe('commute', () => {
  const withCommute = (o: Partial<PlanningInput> = {}) =>
    input({
      events: [event({ id: 'uni', weekly: true, start: '09:00', end: '17:00' })],
      preferences: { ...input().preferences, commute: { mode: 'bus', minutesPerDay: 60 } },
      ...o,
    })

  it('reserves half before the first and half after the last fixed commitment, only on days that have one', () => {
    const blocks = generatePlan(withCommute()).commuteBlocks!.filter((b) => b.date === WEEK)
    expect(blocks).toEqual([
      { date: WEEK, start: '08:30', end: '09:00', mode: 'bus' },
      { date: WEEK, start: '17:00', end: '17:30', mode: 'bus' },
    ])
    // the event is weekly on Mondays only: Tuesday has none
    expect(generatePlan(withCommute()).commuteBlocks!.filter((b) => b.date === '2026-09-15')).toEqual([])
  })

  it('takes commute time out of the free time and never plans over it', () => {
    const base = generatePlan(input({ ...withCommute(), preferences: input().preferences }))
    const plan = generatePlan(withCommute({ activities: [activity({ id: 'gym', sessionsPerWeek: 7 })] }))
    expect(plan.availableMinutesByDay[WEEK]).toBe(base.availableMinutesByDay[WEEK] - 60)
    for (const i of plan.scheduledItems.filter((x) => x.date === WEEK)) {
      expect(i.end <= '08:30' || i.start >= '17:30').toBe(true)
    }
  })

  it('does nothing without a commute setting', () => {
    expect(generatePlan(input({ events: [event({ id: 'uni', weekly: true })] })).commuteBlocks).toEqual([])
  })
})

describe('stable replanning', () => {
  const activities = [activity({ id: 'gym', sessionsPerWeek: 3 }), activity({ id: 'study', sessionsPerWeek: 2, sessionMinutes: 90 })]
  const original = generatePlan(input({ activities }))

  it('keeps every session when nothing changed', () => {
    const again = generatePlan(input({ activities, previousItems: original.scheduledItems }))
    expect(again.scheduledItems).toEqual(original.scheduledItems)
    expect(again.changes).toMatchObject({ kept: 5, moved: [], dropped: [], added: [] })
  })

  it('moves only the session hit by a new one-off event', () => {
    const hit = original.scheduledItems[2]
    const surprise = event({ id: 'exam', date: hit.date, start: hit.start, end: hit.end })
    const revised = generatePlan(input({ activities, events: [surprise], previousItems: original.scheduledItems }))

    expect(revised.changes!.kept).toBe(4)
    expect(revised.changes!.moved).toHaveLength(1)
    expect(revised.changes!.moved[0].from).toEqual(hit)
    expect(revised.scheduledItems).toHaveLength(5)
    expect(revised.status).toBe('fully_feasible')
    // nothing overlaps the new event, and the untouched sessions are exactly where they were
    const overlaps = revised.scheduledItems.some((i) => i.date === surprise.date && i.start < surprise.end && i.end > surprise.start)
    expect(overlaps).toBe(false)
    for (const i of original.scheduledItems.filter((x) => x.id !== hit.id)) expect(revised.scheduledItems).toContainEqual(i)
  })

  it('keeps sessions in the past and does not count them as changes', () => {
    const later = generatePlan(input({ activities, today: '2026-09-17', previousItems: original.scheduledItems }))
    const past = original.scheduledItems.filter((i) => i.date < '2026-09-17')
    for (const i of past) expect(later.scheduledItems).toContainEqual(i)
  })

  const wall = (date: string) => [event({ id: 'wall', date, start: '08:00', end: '22:00' })]
  const previous = [{ id: 'gym:2026-09-14:10:00', activityId: 'gym', date: '2026-09-14', start: '10:00', end: '11:00', reasons: [] }]

  it('moves a session to another day when its day is full', () => {
    const revised = generatePlan(input({ activities: [activity({ id: 'gym' })], events: wall('2026-09-14'), previousItems: previous }))
    expect(revised.changes!.moved).toHaveLength(1)
    expect(revised.changes!.dropped).toEqual([])
  })

  it('reports a session as dropped when nothing is free any more', () => {
    const events = Array.from({ length: 7 }, (_, d) => wall(`2026-09-${String(14 + d)}`)[0]).map((e, d) => ({ ...e, id: `wall${d}` }))
    const revised = generatePlan(input({ activities: [activity({ id: 'gym' })], events, previousItems: previous }))
    expect(revised.changes!.dropped).toEqual(previous)
    expect(revised.status).toBe('infeasible')
  })
})
