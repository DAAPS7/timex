import { toHHMM, weekDates } from '../../../shared/time'
import type {
  Activity,
  Conflict,
  Feasibility,
  PlanningInput,
  PlanningResult,
  Priority,
  ReasonCode,
  ScheduledItem,
} from '../../../shared/domain'
import {
  computeAvailability,
  detectOverlappingEvents,
  subtractIntervals,
  sumMinutes,
  type DayIntervals,
} from './availability'
import { scoreCandidate, type Candidate, type PlacedSlot } from './scoring'
import { SCORING } from './scoringConfig'

export const ENGINE_VERSION = '0.1.0'

const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const STEP = SCORING.slotStepMinutes

interface Plan {
  activity: Activity
  priority: Priority
  deadline?: string
}

/** Merge the activity with its goal: highest priority and earliest deadline win. */
function normalize(input: PlanningInput): Plan[] {
  return input.activities.map((activity) => {
    const goal = input.goals.find((g) => g.id === activity.goalId)
    const priority =
      goal && PRIORITY_RANK[goal.priority] > PRIORITY_RANK[activity.priority] ? goal.priority : activity.priority
    const deadlines = [activity.deadline, goal?.deadline].filter((d): d is string => !!d).sort()
    return { activity, priority, deadline: deadlines[0] }
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
  const free = computeAvailability(input)
  const originalFree = structuredClone(free)
  const availableMinutesByDay = Object.fromEntries(dates.map((d) => [d, sumMinutes(free[d])]))
  const breakMinutes = input.preferences.minBreakMinutes
  const maxDaily = input.preferences.maxDailyPlannedMinutes

  const load: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]))
  const placed: PlacedSlot[] = []
  const items: ScheduledItem[] = []
  const conflicts: Conflict[] = []
  let requested = 0

  for (const plan of order(normalize(input))) {
    const { activity, priority, deadline } = plan
    const window = dates.filter((d) => !deadline || d <= deadline)
    const activityRequested = activity.sessionsPerWeek * activity.sessionMinutes
    requested += activityRequested
    let scheduled = 0

    let sessions = 0
    while (sessions < activity.sessionsPerWeek && placeSession()) sessions++

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
    function placeSession(): boolean {
      for (let duration = activity.sessionMinutes; duration >= minSession(activity); duration -= STEP) {
        const candidates = candidatesFor(free, window, duration, load, maxDaily)
        if (candidates.length === 0) continue
        let best: { c: Candidate; score: number; reasons: ReasonCode[] } | undefined
        for (const c of candidates) {
          const s = scoreCandidate(c, {
            activity, priority, deadline, today: input.today, placed, maxDailyMinutes: maxDaily, breakMinutes,
          })
          if (!best || s.score > best.score) best = { c, ...s } // ties keep the earliest candidate
        }
        commit(best!.c, best!.reasons, duration < activity.sessionMinutes)
        return true
      }
      return false
    }

    function commit(c: Candidate, reasons: ReasonCode[], shortened: boolean) {
      const pad = { start: c.start - breakMinutes, end: c.end + breakMinutes }
      free[c.date] = subtractIntervals(free[c.date], [pad])
      load[c.date] += c.end - c.start
      scheduled += c.end - c.start
      placed.push({ activityId: activity.id, ...c })
      items.push({
        id: `${activity.id}:${c.date}:${toHHMM(c.start)}`,
        activityId: activity.id,
        date: c.date,
        start: toHHMM(c.start),
        end: toHHMM(c.end),
        reasons: shortened ? [...reasons, 'SHORTENED'] : reasons,
      })
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
  }
}

