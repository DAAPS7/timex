import { daysBetween, toMinutes, weekdayOf } from '../../../shared/time'
import type { Activity, Priority, ReasonCode } from '../../../shared/domain'
import { SCORING } from './scoringConfig'

export interface Candidate {
  date: string
  start: number
  end: number
  overlap?: boolean // sits on busy time that allows other things (travel, "allows other things" events)
}

export interface PlacedSlot extends Candidate {
  activityId: string
}

export interface ScoreContext {
  activity: Activity
  priority: Priority // effective priority (activity or its goal, whichever is higher)
  deadline?: string
  today: string
  placed: PlacedSlot[] // everything already scheduled in this run
  maxDailyMinutes: number
  breakMinutes: number
  splitOverDay?: boolean // the activity is delivered as several blocks that belong on the same day, spaced apart
}

export interface Scored {
  score: number
  reasons: ReasonCode[]
}

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))

/** Pure function: same candidate + same context => same score. Replaceable by a smarter optimizer later. */
export function scoreCandidate(c: Candidate, ctx: ScoreContext): Scored {
  const { activity, placed } = ctx
  const duration = c.end - c.start
  const reasons: ReasonCode[] = []
  let score = SCORING.priority[ctx.priority]
  if (ctx.priority === 'high' || ctx.priority === 'critical') reasons.push('HIGH_PRIORITY')

  if (c.overlap) {
    score += SCORING.overlapBonus
    reasons.push('DURING_TRAVEL')
  }

  // preferred time window
  if (activity.preferredStart && activity.preferredEnd) {
    const inside = overlap(c.start, c.end, toMinutes(activity.preferredStart), toMinutes(activity.preferredEnd))
    score += SCORING.preferredTime * (inside / duration)
    if (inside === duration) reasons.push('PREFERRED_TIME')
  }

  // preferred days
  if (activity.preferredDays.length > 0 && activity.preferredDays.includes(weekdayOf(c.date))) {
    score += SCORING.preferredDay
    reasons.push('PREFERRED_DAY')
  }

  // distribution: spread sessions of the same activity across the week
  const sameActivity = placed.filter((p) => p.activityId === activity.id)
  const sameDayBlocks = sameActivity.filter((p) => p.date === c.date)
  const sameDay = sameDayBlocks.length
  if (ctx.splitOverDay && sameDay > 0) {
    // blocks of a split activity: the farther from the other blocks of that day, the better
    const gap = Math.min(...sameDayBlocks.map((p) => Math.max(0, c.start - p.end, p.start - c.end)))
    score += (SCORING.dayGap * Math.min(gap, SCORING.dayGapMinutes)) / SCORING.dayGapMinutes
    if (gap >= 60) reasons.push('SPLIT_OVER_DAY')
  } else {
    score -= SCORING.sameDayPenalty * sameDay
  }
  if (sameActivity.length > 0 && sameDay === 0) {
    const nearest = Math.min(...sameActivity.map((p) => Math.abs(daysBetween(p.date, c.date))))
    score += (SCORING.spread * Math.min(nearest, 2)) / 2
    if (nearest >= 2) reasons.push('SPREAD_OUT')
  }

  // context switching: touching a different activity
  const touchesOther = placed.some(
    (p) =>
      p.date === c.date &&
      p.activityId !== activity.id &&
      (Math.abs(p.end - c.start) <= ctx.breakMinutes + 15 || Math.abs(c.end - p.start) <= ctx.breakMinutes + 15),
  )
  if (touchesOther) score -= SCORING.contextSwitchPenalty

  // workload
  const plannedBefore = placed.filter((p) => p.date === c.date).reduce((n, p) => n + (p.end - p.start), 0)
  score -= (SCORING.workloadPenalty * (plannedBefore + duration)) / ctx.maxDailyMinutes
  if (plannedBefore / ctx.maxDailyMinutes < SCORING.lightDayThreshold) reasons.push('LIGHT_DAY')

  // inconvenient hours
  const comfy = overlap(c.start, c.end, toMinutes(SCORING.comfortableStart), toMinutes(SCORING.comfortableEnd))
  score -= SCORING.inconveniencePenalty * (1 - comfy / duration)

  // deadline urgency: closer deadline => stronger pull toward earlier slots
  if (ctx.deadline) {
    const remaining = Math.max(1, daysBetween(ctx.today, ctx.deadline))
    const urgency = Math.max(0, 1 - remaining / SCORING.deadlineHorizonDays)
    const offset = Math.max(0, daysBetween(ctx.today, c.date))
    const earliness = Math.max(0, 1 - offset / remaining)
    score += SCORING.deadlineUrgency * urgency * earliness
    if (urgency > 0.3 && earliness > 0.4) reasons.push('BEFORE_DEADLINE')
  }

  return { score, reasons }
}
