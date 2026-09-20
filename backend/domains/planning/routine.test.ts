import { describe, expect, it } from 'vitest'
import { preferencesSchema, type Activity, type CalendarEvent, type PlanningInput } from '../../../shared/domain'
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
      preferences: { ...input().preferences, commute: { modes: ['bus'], minutesPerDay: 60 } },
      ...o,
    })

  it('reserves half before the first and half after the last fixed commitment, only on days that have one', () => {
    const blocks = generatePlan(withCommute()).commuteBlocks!.filter((b) => b.date === WEEK)
    expect(blocks).toEqual([
      { date: WEEK, start: '08:30', end: '09:00', modes: ['bus'], overlappable: true },
      { date: WEEK, start: '17:00', end: '17:30', modes: ['bus'], overlappable: true },
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

describe('free time', () => {
  it('does not count the part of today that has already gone by', () => {
    const full = generatePlan(input()).availableMinutesByDay[WEEK]
    const noon = generatePlan(input({ nowMinutes: 12 * 60 })).availableMinutesByDay[WEEK]
    expect(full).toBe(14 * 60)
    expect(noon).toBe(10 * 60)
  })

  it('reports what is still free after the planned sessions, and leaves future days alone', () => {
    const plan = generatePlan(input({ activities: [activity({ id: 'gym', sessionsPerWeek: 1, sessionMinutes: 60 })] }))
    const day = plan.scheduledItems[0].date
    expect(plan.freeMinutesByDay[day]).toBe(plan.availableMinutesByDay[day] - 60)
    const other = Object.keys(plan.freeMinutesByDay).find((d) => d !== day)!
    expect(plan.freeMinutesByDay[other]).toBe(plan.availableMinutesByDay[other])
  })

  it('a later week in the same request still has all its time', () => {
    const next = generatePlan(input({ weekStart: '2026-09-21', today: '2026-09-20', nowMinutes: 20 * 60 }))
    expect(Object.values(next.availableMinutesByDay).every((m) => m === 14 * 60)).toBe(true)
  })
})

describe('several transport modes', () => {
  it('reserves one commute for a combination of modes', () => {
    const modes = ['walk', 'train'] as const
    const plan = generatePlan(
      input({
        events: [event({ id: 'uni', weekly: true, start: '09:00', end: '17:00' })],
        preferences: { ...input().preferences, commute: { modes: [...modes], minutesPerDay: 60 } },
      }),
    )
    expect(plan.commuteBlocks![0].modes).toEqual(['walk', 'train'])
  })

  it('upgrades stored data that has a single mode', () => {
    const parsed = preferencesSchema.parse({ ...input().preferences, commute: { mode: 'bus', minutesPerDay: 45 } })
    expect(parsed.commute).toEqual({ modes: ['bus'], minutesPerDay: 45 })
  })

  it('needs at least one mode', () => {
    expect(preferencesSchema.safeParse({ ...input().preferences, commute: { modes: [], minutesPerDay: 45 } }).success).toBe(false)
  })
})

describe('essentials on top of free time', () => {
  const lunch = { id: 'l', title: 'Almoço', start: '12:30', end: '13:30', kind: 'meal' as const }
  const withEssentials = (o: Partial<PlanningInput> = {}) =>
    input({ preferences: { ...input().preferences, essentials: [lunch] }, ...o })

  it('reserves them every day and takes them out of the free time', () => {
    const plan = generatePlan(withEssentials())
    expect(plan.essentialBlocks!.filter((b) => b.title === 'Almoço')).toHaveLength(7)
    expect(plan.availableMinutesByDay[WEEK]).toBe(14 * 60 - 60)
  })

  it('never plans an activity over them', () => {
    const plan = generatePlan(withEssentials({ activities: [activity({ id: 'gym', sessionsPerWeek: 7, sessionMinutes: 240 })] }))
    for (const i of plan.scheduledItems) expect(i.end <= '12:30' || i.start >= '13:30').toBe(true)
  })

  it('only keeps the part that is not already taken by a fixed event', () => {
    const plan = generatePlan(withEssentials({ events: [event({ id: 'uni', start: '13:00', end: '17:00' })] }))
    expect(plan.essentialBlocks!.find((b) => b.date === WEEK)).toMatchObject({ start: '12:30', end: '13:00' })
    expect(plan.availableMinutesByDay[WEEK]).toBe(14 * 60 - 240 - 30)
  })

  it('does nothing when there are none', () => {
    expect(generatePlan(input()).essentialBlocks).toEqual([])
  })
})

describe('remote commitments', () => {
  it('reserve no travel, while in-person ones on the same day still do', () => {
    const commute = { modes: ['bus' as const], minutesPerDay: 60 }
    const prefs = { ...input().preferences, commute }
    const remote = generatePlan(input({ events: [event({ id: 'online', weekly: true, remote: true })], preferences: prefs }))
    expect(remote.commuteBlocks).toEqual([])
    const mixed = generatePlan(
      input({ events: [event({ id: 'online', weekly: true, remote: true }), event({ id: 'lab', weekly: true, start: '14:00', end: '17:00' })], preferences: prefs }),
    )
    // travel wraps only the in-person commitment (14:00-17:00), not the remote one in the morning
    expect(mixed.commuteBlocks!.filter((b) => b.date === WEEK).map((b) => [b.start, b.end])).toEqual([['13:30', '14:00'], ['17:00', '17:30']])
  })
})

describe('activities split over the day', () => {
  const study = activity({ id: 'study', sessionsPerWeek: 1, sessionMinutes: 120, splitMinutes: 30 })

  it('delivers one session as short blocks on the same day, with gaps between them', () => {
    const plan = generatePlan(input({ activities: [study] }))
    const items = plan.scheduledItems
    expect(items).toHaveLength(4)
    expect(new Set(items.map((i) => i.date)).size).toBe(1)
    expect(items.every((i) => i.end > i.start && toMin(i.end) - toMin(i.start) === 30)).toBe(true)
    for (let n = 1; n < items.length; n++) expect(toMin(items[n].start) - toMin(items[n - 1].end)).toBeGreaterThanOrEqual(60)
    expect(plan.status).toBe('fully_feasible')
    expect(plan.scheduledMinutes).toBe(120)
  })

  it('keeps the blocks where they are when replanning with nothing changed', () => {
    const first = generatePlan(input({ activities: [study] }))
    const again = generatePlan(input({ activities: [study], previousItems: first.scheduledItems }))
    expect(again.scheduledItems).toEqual(first.scheduledItems)
  })

  it('a split at least as long as the session changes nothing', () => {
    const plan = generatePlan(input({ activities: [activity({ id: 's', sessionMinutes: 60, splitMinutes: 60 })] }))
    expect(plan.scheduledItems).toHaveLength(1)
  })
})

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

describe('travel placed by the user', () => {
  const commute = { modes: ['bus' as const], minutesPerDay: 60 }
  const prefs = { ...input().preferences, commute }

  it('replaces the automatic estimate on that day only', () => {
    const plan = generatePlan(
      input({
        events: [
          event({ id: 'uni', weekly: true, start: '09:00', end: '17:00' }),
          event({ id: 'trip', kind: 'travel', start: '07:30', end: '08:45', date: WEEK }),
        ],
        preferences: prefs,
      }),
    )
    expect(plan.commuteBlocks!.filter((b) => b.date === WEEK)).toEqual([])
    // the other days the university repeats on are not affected (weekly = Mondays only here, so check the estimate elsewhere)
    const other = generatePlan(input({ events: [event({ id: 'uni', weekly: true, start: '09:00', end: '17:00' })], preferences: prefs }))
    expect(other.commuteBlocks!.filter((b) => b.date === WEEK)).toHaveLength(2)
  })

  it('is not treated as an in-person commitment that needs its own travel', () => {
    const plan = generatePlan(input({ events: [event({ id: 'trip', weekly: true, kind: 'travel' })], preferences: prefs }))
    expect(plan.commuteBlocks).toEqual([])
  })
})

describe('overlapping where other things can be done', () => {
  const trip = event({ id: 'trip', kind: 'travel', canOverlap: true, start: '08:00', end: '09:00' })
  const reading = activity({ id: 'read', sessionMinutes: 45, canOverlap: true, preferredStart: '08:00', preferredEnd: '09:00' })

  it('lets a compatible activity sit on top of the travel', () => {
    const plan = generatePlan(input({ events: [trip], activities: [reading] }))
    expect(plan.scheduledItems[0]).toMatchObject({ date: WEEK, start: '08:00' })
    expect(plan.scheduledItems[0].reasons).toContain('DURING_TRAVEL')
  })

  it('does not let an activity that is not compatible use it', () => {
    const plan = generatePlan(input({ events: [trip], activities: [{ ...reading, canOverlap: false }] }))
    const i = plan.scheduledItems[0]
    expect(i.date === WEEK && i.start < '09:00').toBe(false)
  })

  it('does not put two things on the same overlap time, and no overlap warning for it', () => {
    const other = activity({ id: 'pod', sessionMinutes: 45, canOverlap: true, preferredStart: '08:00', preferredEnd: '09:00' })
    const plan = generatePlan(input({ events: [trip, event({ id: 'lect', canOverlap: true, start: '08:30', end: '09:30' })], activities: [reading, other] }))
    const onWeek = plan.scheduledItems.filter((i) => i.date === WEEK && i.reasons.includes('DURING_TRAVEL'))
    for (const a of onWeek) for (const b of onWeek) if (a !== b) expect(a.end <= b.start || b.end <= a.start).toBe(true)
    expect(plan.warnings).toEqual([])
  })

  it('keeps an overlapped session when replanning', () => {
    const first = generatePlan(input({ events: [trip], activities: [reading] }))
    const again = generatePlan(input({ events: [trip], activities: [reading], previousItems: first.scheduledItems }))
    expect(again.scheduledItems).toEqual(first.scheduledItems)
  })
})

describe('only in the preferred hours', () => {
  it('never places outside them when made mandatory, and reports the conflict when they are full', () => {
    const gym = activity({ id: 'gym', sessionsPerWeek: 7, sessionMinutes: 60, preferredStart: '18:00', preferredEnd: '19:00', onlyPreferred: true })
    const plan = generatePlan(input({ activities: [gym] }))
    expect(plan.scheduledItems.every((i) => i.start >= '18:00' && i.end <= '19:00')).toBe(true)
    const busy = generatePlan(input({ activities: [gym], events: [event({ id: 'x', start: '17:30', end: '19:30' })] }))
    expect(busy.scheduledItems.filter((i) => i.date === WEEK)).toEqual([])
  })

  it('only prefers them by default', () => {
    const gym = activity({ id: 'gym', sessionsPerWeek: 1, preferredStart: '18:00', preferredEnd: '19:00' })
    const plan = generatePlan(input({ activities: [gym], events: [event({ id: 'x', weekly: true, start: '17:00', end: '20:00' })] }))
    expect(plan.scheduledItems).toHaveLength(1)
  })
})

describe('research during university classes', () => {
  const classes = event({ id: 'uni', title: 'Aulas de Universidade', weekly: true, canOverlap: true, start: '09:00', end: '13:00' })
  const meeting = event({ id: 'meet', title: 'Reunião', canOverlap: true, start: '14:00', end: '15:00' })
  const research = (o: Partial<Activity> = {}) =>
    activity({ id: 'inv', name: 'Investigação', sessionsPerWeek: 4, sessionMinutes: 60, canOverlap: true, overlapWith: ['aulas'], ...o })
  const overlapped = (plan: ReturnType<typeof generatePlan>) => plan.scheduledItems.filter((i) => i.reasons.includes('DURING_TRAVEL'))

  it('does some of it inside class, and only inside class', () => {
    const plan = generatePlan(input({ events: [classes, meeting], activities: [research()] }))
    expect(overlapped(plan).length).toBeGreaterThan(0)
    for (const i of overlapped(plan)) expect(i.date === WEEK && i.start >= '09:00' && i.end <= '13:00').toBe(true)
  })

  it('stops at the weekly cap for time done inside class', () => {
    const plan = generatePlan(input({ events: [classes], activities: [research({ sessionsPerWeek: 4, maxOverlapMinutes: 60 })] }))
    expect(overlapped(plan)).toHaveLength(1)
    expect(plan.scheduledItems).toHaveLength(4) // the rest goes to free time
    expect(plan.status).toBe('fully_feasible')
  })

  it('matches titles without caring about case or accents', () => {
    const plan = generatePlan(input({ events: [meeting], activities: [research({ overlapWith: ['reuniao'] })] }))
    expect(overlapped(plan).every((i) => i.start >= '14:00' && i.end <= '15:00')).toBe(true)
    expect(overlapped(plan).length).toBeGreaterThan(0)
  })
})
