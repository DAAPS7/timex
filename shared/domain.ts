// Single source of truth for domain shapes. Zod schemas validate external input on the backend;
// the frontend only imports the inferred types (`import type`), so zod is not bundled client-side.
import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')

export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export type Priority = z.infer<typeof prioritySchema>

export const calendarEventSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(120),
    date, // first occurrence
    start: time,
    end: time,
    weekly: z.boolean().default(false), // repeats every week on the same weekday
    location: z.string().max(120).optional(),
  })
  .refine((e) => e.end > e.start, { message: 'end must be after start', path: ['end'] })
export type CalendarEvent = z.infer<typeof calendarEventSchema>

export const activitySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  sessionsPerWeek: z.number().int().min(1).max(14),
  sessionMinutes: z.number().int().min(15).max(480),
  minSessionMinutes: z.number().int().min(15).max(480).optional(), // hard minimum for a useful session
  priority: prioritySchema,
  preferredDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  preferredStart: time.optional(),
  preferredEnd: time.optional(),
  deadline: date.optional(),
  goalId: z.string().max(64).optional(),
})
export type Activity = z.infer<typeof activitySchema>

export const goalSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  deadline: date,
  priority: prioritySchema,
})
export type Goal = z.infer<typeof goalSchema>

export const preferencesSchema = z.object({
  timezone: z.string().min(1).max(64),
  dayStart: time, // start of the waking day; everything outside [dayStart, dayEnd] is sleep/unavailable
  dayEnd: time,
  minBreakMinutes: z.number().int().min(0).max(120),
  maxDailyPlannedMinutes: z.number().int().min(60).max(960),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const planningInputSchema = z.object({
  today: date,
  weekStart: date,
  events: z.array(calendarEventSchema).max(500),
  activities: z.array(activitySchema).max(100),
  goals: z.array(goalSchema).max(100),
  preferences: preferencesSchema,
})
export type PlanningInput = z.infer<typeof planningInputSchema>

// ---- Planning output ----

export const reasonCodeSchema = z.enum([
  'HIGH_PRIORITY',
  'PREFERRED_TIME',
  'PREFERRED_DAY',
  'BEFORE_DEADLINE',
  'SPREAD_OUT',
  'LIGHT_DAY',
  'SHORTENED',
])
export type ReasonCode = z.infer<typeof reasonCodeSchema>

export const scheduledItemSchema = z.object({
  id: z.string().max(128),
  activityId: z.string().max(64),
  date,
  start: time,
  end: time,
  reasons: z.array(reasonCodeSchema).max(12),
})
export type ScheduledItem = z.infer<typeof scheduledItemSchema>

export type ConflictCode = 'INSUFFICIENT_AVAILABLE_TIME' | 'DEADLINE_UNACHIEVABLE'

export interface Conflict {
  code: ConflictCode
  activityId: string
  requestedMinutes: number
  scheduledMinutes: number
  availableInWindowMinutes: number // free time that existed in the allowed window before planning
  deadline?: string
}

export interface Warning {
  code: 'OVERLAPPING_EVENTS'
  detail: string
}

export type Feasibility = 'fully_feasible' | 'partially_feasible' | 'infeasible'

export interface PlanningResult {
  engineVersion: string
  status: Feasibility
  requestedMinutes: number
  scheduledMinutes: number
  unscheduledMinutes: number
  scheduledItems: ScheduledItem[]
  conflicts: Conflict[]
  warnings: Warning[]
  availableMinutesByDay: Record<string, number>
}

export type PlanStatus = 'proposed' | 'accepted' | 'modified'

export interface Plan {
  id: string
  weekStart: string
  status: PlanStatus
  version: number
  createdAt: string
  result: PlanningResult
}

// ---- Assistant ----

export type ProposedAction =
  // Upserts: if the id already exists in the user's data, the client updates it instead of duplicating it.
  | { type: 'create_activity'; summary: string; payload: Activity }
  | { type: 'create_goal'; summary: string; payload: Goal }

export interface AssistantReply {
  reply: string
  proposals: ProposedAction[]
  plan?: PlanningResult // set when the assistant ran the planning engine
  planAdoptable?: boolean // false when the plan includes hypothetical (unapplied) activities
}

export const assistantRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  state: planningInputSchema,
  currentItems: z.array(scheduledItemSchema).max(500).optional(), // the plan the user is looking at

})
export type AssistantRequest = z.infer<typeof assistantRequestSchema>
