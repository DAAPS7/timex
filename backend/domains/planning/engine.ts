import { toHHMM, toMinutes, weekDates } from '../../../shared/time'
import type {
  Activity,
  Conflict,
  Feasibility,
  PlanChanges,
  PlanningInput,
  PlanningResult,
  Priority,
  ReasonCode,
  ScheduledItem,
} from '../../../shared/domain'
import {
  computeAvailability,
  computeCommute,
  computeEssentials,
  detectOverlappingEvents,
  subtractIntervals,
  sumMinutes,
  type DayIntervals,
} from './availability'
import { scoreCandidate, type Candidate, type PlacedSlot } from './scoring'
import { SCORING } from './scoringConfig'

export const ENGINE_VERSION = '0.2.0'

const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const STEP = SCORING.slotStepMinutes

interface Plan {
  activity: Activity // effective: a splittable activity is expressed as many short sessions
  priority: Priority
  deadline?: string
  blocksPerSession: number // > 1 when the original session was split into blocks
}

/**
 * A splittable activity (session of 120 min, blocks of 30) becomes 4 blocks per session: to the rest of the engine they
 * are ordinary short sessions, which keeps requested/scheduled minutes, replanning and conflicts consistent.
 */
function effective(activity: Activity): { activity: Activity; blocksPerSession: number } {
  const split = activity.splitMinutes
  if (!split || split >= activity.sessionMinutes) return { activity, blocksPerSession: 1 }
  const blocks = Math.ceil(activity.sessionMinutes / split)
  return {
    activity: { ...activity, sessionMinutes: split, minSessionMinutes: split, sessionsPerWeek: activity.sessionsPerWeek * blocks },
    blocksPerSession: blocks,
  }
}

/** Merge the activity with its goal: highest priority and earliest deadline win. */
function normalize(input: PlanningInput): Plan[] {
  return input.activities.map((original) => {
    const { activity, blocksPerSession } = effective(original)
    const goal = input.goals.find((g) => g.id === activity.goalId)
    const priority =
      goal && PRIORITY_RANK[goal.priority] > PRIORITY_RANK[activity.priority] ? goal.priority : activity.priority
    const deadlines = [activity.deadline, goal?.deadline].filter((d): d is string => !!d).sort()
    return { activity, priority, deadline: deadlines[0], blocksPerSession }
  })
}

// Hard deadlines first, then priority, then bigger demands; id last for determinism.
function order(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    if (!!a.deadline !== !!b.deadline) return a.deadline ? -1 : 1
    if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1
    if (a.priority !== b.priority) return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    const demandA = a.activity.sessionsPerWeek * a.activity.sessionMinutes
    const demandB = b.activity.sessionsPerWeek * b.activity.sessionMinutes
    return demandB - demandA || a.activity.id.localeCompare(b.activity.id)
  })
}

const minSession = (a: Activity): number =>
  Math.min(a.sessionMinutes, a.minSessionMinutes ?? Math.max(STEP, Math.round(a.sessionMinutes / 2 / STEP) * STEP))

/** Slots on the step grid that fit entirely inside a free interval, within the allowed dates. */
function candidatesFor(free: DayIntervals, dates: string[], duration: number, load: Record<string, number>, max: number) {
  const out: Candidate[] = []
  for (const date of dates) {
    if (load[date] + duration > max) continue // hard: daily workload cap
    for (const iv of free[date]) {
      for (let start = Math.ceil(iv.start / STEP) * STEP; start + duration <= iv.end; start += STEP) {
        out.push({ date, start, end: start + duration })
      }
    }
  }
  return out
}

export function generatePlan(input: PlanningInput): PlanningResult {
  const dates = weekDates(input.weekStart)
  const lastDate = dates[dates.length - 1]
  const commuteBlocks = computeCommute(input, dates)
  const essentialBlocks = computeEssentials(input, dates, commuteBlocks)
  const free = computeAvailability(input, commuteBlocks, essentialBlocks)
  const originalFree = structuredClone(free)
  const availableMinutesByDay = Object.fromEntries(dates.map((d) => [d, sumMinutes(free[d])]))
  // Free time left after planning: what was available minus the sessions that sit inside it (past sessions do not count).
  const freeMinutesByDay = (): Record<string, number> =>
    Object.fromEntries(
      dates.map((d) => {
        const planned = placed.filter((p) => p.date === d).map((p) => ({ start: p.start, end: p.end }))
        return [d, sumMinutes(subtractIntervals(originalFree[d], planned))]
      }),
    )
  const breakMinutes = input.preferences.minBreakMinutes
  const maxDaily = input.preferences.maxDailyPlannedMinutes

  const load: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]))
  const placed: PlacedSlot[] = []
  const items: ScheduledItem[] = []
  const conflicts: Conflict[] = []
  let requested = 0

  function commitSlot(activityId: string, c: Candidate, item: Pick<ScheduledItem, 'reasons'> & { id?: string }) {
    const pad = { start: c.start - breakMinutes, end: c.end + breakMinutes }
    free[c.date] = subtractIntervals(free[c.date], [pad])
    load[c.date] += c.end - c.start
    placed.push({ activityId, ...c })
    items.push({
      id: item.id ?? `${activityId}:${c.date}:${toHHMM(c.start)}`,
      activityId,
      date: c.date,
      start: toHHMM(c.start),
      end: toHHMM(c.end),
      reasons: item.reasons,
    })
  }

  // Stable replanning: keep the sessions of the previous plan that are still valid (past ones always), move the rest.
  const keptIds = new Set<string>()
  const removed: ScheduledItem[] = []
  const kept = new Map<string, { sessions: number; minutes: number }>()
  const plans = order(normalize(input))
  const activityOf = (id: string) => plans.find((p) => p.activity.id === id)?.activity
  const previous = [...(input.previousItems ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  for (const prev of previous) {
    const activity = activityOf(prev.activityId)
    const past = prev.date < input.today
    const c: Candidate = { date: prev.date, start: toMinutes(prev.start), end: toMinutes(prev.end) }
    const totals = kept.get(prev.activityId) ?? { sessions: 0, minutes: 0 }
    const validLength = !!activity && c.end - c.start <= activity.sessionMinutes && c.end - c.start >= minSession(activity)
    const fits = dates.includes(prev.date) && (free[prev.date] ?? []).some((iv) => iv.start <= c.start && iv.end >= c.end)
    if (activity && validLength && totals.sessions < activity.sessionsPerWeek && (past || fits)) {
      commitSlot(prev.activityId, c, prev)
      keptIds.add(prev.id)
      kept.set(prev.activityId, { sessions: totals.sessions + 1, minutes: totals.minutes + c.end - c.start })
    } else if (!past) {
      removed.push(prev)
    }
  }

  for (const plan of plans) {
    const { activity, priority, deadline, blocksPerSession } = plan
    const window = dates.filter((d) => !deadline || d <= deadline)
    const activityRequested = activity.sessionsPerWeek * activity.sessionMinutes
    requested += activityRequested
    let scheduled = kept.get(activity.id)?.minutes ?? 0

    let sessions = kept.get(activity.id)?.sessions ?? 0
    // The blocks of one session go on the same day when they fit there (spaced apart); otherwise anywhere in the window.
    const lastBlockDate = () => placed.filter((p) => p.activityId === activity.id).at(-1)?.date
    while (sessions < activity.sessionsPerWeek && placeSession(sessions % blocksPerSession !== 0 ? lastBlockDate() : undefined)) sessions++

    if (scheduled < activityRequested) {
      const deadlineLimited = !!deadline && deadline < lastDate
      conflicts.push({
        code: deadlineLimited ? 'DEADLINE_UNACHIEVABLE' : 'INSUFFICIENT_AVAILABLE_TIME',
        activityId: activity.id,
        requestedMinutes: activityRequested,
        scheduledMinutes: scheduled,
        availableInWindowMinutes: window.reduce((n, d) => n + sumMinutes(originalFree[d]), 0),
        ...(deadline ? { deadline } : {}),
      })
    }

    // Try the full session length first, shrinking down to the hard minimum.
    function placeSession(sameDate?: string): boolean {
      for (let duration = activity.sessionMinutes; duration >= minSession(activity); duration -= STEP) {
        const onDay = sameDate ? candidatesFor(free, [sameDate], duration, load, maxDaily) : []
        const candidates = onDay.length > 0 ? onDay : candidatesFor(free, window, duration, load, maxDaily)
        if (candidates.length === 0) continue
        let best: { c: Candidate; score: number; reasons: ReasonCode[] } | undefined
        for (const c of candidates) {
          const s = scoreCandidate(c, {
            activity, priority, deadline, today: input.today, placed, maxDailyMinutes: maxDaily, breakMinutes, splitOverDay: blocksPerSession > 1,
          })
          if (!best || s.score > best.score) best = { c, ...s } // ties keep the earliest candidate
        }
        commitSlot(activity.id, best!.c, { reasons: duration < activity.sessionMinutes ? [...best!.reasons, 'SHORTENED'] : best!.reasons })
        scheduled += duration
        return true
      }
      return false
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  const scheduledMinutes = placed.reduce((n, p) => n + (p.end - p.start), 0)
  const status: Feasibility =
    scheduledMinutes >= requested ? 'fully_feasible' : scheduledMinutes === 0 ? 'infeasible' : 'partially_feasible'

  return {
    engineVersion: ENGINE_VERSION,
    status,
    requestedMinutes: requested,
    scheduledMinutes,
    unscheduledMinutes: Math.max(0, requested - scheduledMinutes),
    scheduledItems: items,
    conflicts,
    warnings: detectOverlappingEvents(input.events, dates),
    availableMinutesByDay,
    freeMinutesByDay: freeMinutesByDay(),
    commuteBlocks,
    essentialBlocks,
    ...(input.previousItems ? { changes: describeChanges(items, keptIds, removed, input.today) } : {}),
  }
}


/** Pair each removed session with a new one of the same activity (a move); the rest were dropped or are new. */
function describeChanges(items: ScheduledItem[], keptIds: Set<string>, removed: ScheduledItem[], today: string): PlanChanges {
  const fresh = items.filter((i) => !keptIds.has(i.id))
  const moved: PlanChanges['moved'] = []
  const dropped: ScheduledItem[] = []
  for (const from of removed) {
    const index = fresh.findIndex((i) => i.activityId === from.activityId)
    if (index >= 0) moved.push({ from, to: fresh.splice(index, 1)[0] })
    else dropped.push(from)
  }
  return { kept: items.filter((i) => keptIds.has(i.id) && i.date >= today).length, moved, dropped, added: fresh }
}
