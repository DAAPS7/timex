// Single source of truth for domain shapes. Zod schemas validate external input on the backend;
// the frontend only imports the inferred types (`import type`), so zod is not bundled client-side.
import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')

export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export type Priority = z.infer<typeof prioritySchema>

const calendarEventBase = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  date, // first occurrence
  start: time,
  end: time,
  weekly: z.boolean().default(false), // repeats every week on the same weekday
  remote: z.boolean().optional(), // online / from home: no travel is reserved for it
  // 'travel' is time the user places by hand where it is hard to do other things (commute, waiting…); it replaces the
  // automatic commute on that day.
  kind: z.enum(['commitment', 'travel']).optional(),
  canOverlap: z.boolean().optional(), // other things can be done during it (reading on a train): activities that allow it may overlap
    location: z.string().max(120).optional(),
})
const endAfterStart = { message: 'end must be after start', path: ['end'] }
export const calendarEventSchema = calendarEventBase.refine((e) => e.end > e.start, endAfterStart)
export const calendarEventDraftSchema = calendarEventBase.omit({ id: true }).refine((e) => e.end > e.start, endAfterStart)
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
  // The session may be split into blocks of this many minutes, placed at different times of the same day.
  splitMinutes: z.number().int().min(15).max(240).optional(),
  canOverlap: z.boolean().optional(), // can be done at the same time as something else (e.g. during a train ride)
  overlapWith: z.array(z.string().min(1).max(60)).max(10).optional(), // only during these events/travel (by title); empty = any
  maxOverlapMinutes: z.number().int().min(15).max(2400).optional(), // at most this much per week done on overlapped time
  onlyPreferred: z.boolean().optional(), // hard: only inside the preferred hours instead of merely preferring them
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

export const transportModeSchema = z.enum(['walk', 'bike', 'bus', 'train', 'car'])
export type TransportMode = z.infer<typeof transportModeSchema>

// Daily round-trip time lost in transport, by one or more modes (e.g. walk + train). The engine reserves it before the
// first / after the last fixed commitment. Data saved with the former single `mode` is upgraded on read.
export const commuteSchema = z.preprocess(
  (v) => {
    if (v && typeof v === 'object' && 'mode' in v && !('modes' in v)) {
      const { mode, ...rest } = v as { mode: unknown }
      return { ...rest, modes: [mode] }
    }
    return v
  },
  z.object({
    modes: z.array(transportModeSchema).min(1).max(5),
    minutesPerDay: z.number().int().min(0).max(300),
  }),
)
export type Commute = z.infer<typeof commuteSchema>

// Things that must happen every day regardless of the plan (meals, medication, a walk with the dog…). They sit on top of
// free time: the engine reserves them after fixed events and travel, and never plans over them.
export const essentialSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(60),
    start: time,
    end: time,
    kind: z.enum(['meal', 'other']),
  })
  .refine((e) => e.end > e.start, { message: 'end must be after start', path: ['end'] })
export type Essential = z.infer<typeof essentialSchema>

export const preferencesSchema = z.object({
  timezone: z.string().min(1).max(64),
  dayStart: time, // start of the waking day; everything outside [dayStart, dayEnd] is sleep/unavailable
  dayEnd: time,
  minBreakMinutes: z.number().int().min(0).max(120),
  maxDailyPlannedMinutes: z.number().int().min(60).max(960),
  commute: commuteSchema.optional(),
  essentials: z.array(essentialSchema).max(12).optional(),
  setupDone: z.boolean().optional(), // the guided setup (fixed schedule, sleep, transport, activities) was finished or skipped
})
export type Preferences = z.infer<typeof preferencesSchema>

export const reasonCodeSchema = z.enum([
  'HIGH_PRIORITY',
  'PREFERRED_TIME',
  'PREFERRED_DAY',
  'BEFORE_DEADLINE',
  'SPREAD_OUT',
  'LIGHT_DAY',
  'SHORTENED',
  'SPLIT_OVER_DAY',
  'DURING_TRAVEL',
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

export const planningInputSchema = z.object({
  today: date,
  weekStart: date,
  events: z.array(calendarEventSchema).max(500),
  activities: z.array(activitySchema).max(100),
  goals: z.array(goalSchema).max(100),
  preferences: preferencesSchema,
  // The plan being revised: sessions that are still valid are kept, only the affected ones move (stable replanning).
  previousItems: z.array(scheduledItemSchema).max(500).optional(),
  // Minutes since midnight of `today` at request time: what has already elapsed today is not free time any more.
  nowMinutes: z.number().int().min(0).max(1439).optional(),
})
export type PlanningInput = z.infer<typeof planningInputSchema>

// ---- Planning output ----


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

export interface CommuteBlock {
  date: string
  start: string
  end: string
  modes: TransportMode[]
  overlappable?: boolean // reading or listening is possible (bus, train), so compatible activities may overlap it
}

export interface EssentialBlock {
  date: string
  start: string
  end: string
  title: string
  kind: Essential['kind']
}

// What a stable replan did to the previous plan, so the change can be shown and explained.
export interface PlanChanges {
  kept: number
  moved: { from: ScheduledItem; to: ScheduledItem }[]
  dropped: ScheduledItem[] // could not be placed again
  added: ScheduledItem[] // new sessions with no previous counterpart
}

export interface PlanningResult {
  engineVersion: string
  status: Feasibility
  requestedMinutes: number
  scheduledMinutes: number
  unscheduledMinutes: number
  scheduledItems: ScheduledItem[]
  conflicts: Conflict[]
  warnings: Warning[]
  availableMinutesByDay: Record<string, number> // free before planning: waking hours minus events, commute and elapsed time
  freeMinutesByDay: Record<string, number> // still free after the planned sessions
  commuteBlocks?: CommuteBlock[]
  essentialBlocks?: EssentialBlock[]
  changes?: PlanChanges // only when the plan was built from previousItems
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
  | { type: 'create_event'; summary: string; payload: CalendarEvent }

export interface AssistantReply {
  reply: string
  proposals: ProposedAction[]
  plan?: PlanningResult // set when the assistant ran the planning engine
  planAdoptable?: boolean // false when the plan includes hypothetical (unapplied) activities
  planWeekStart?: string // the week `plan` is for (this week or the next one)
}

export const assistantRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  state: planningInputSchema,
  currentItems: z.array(scheduledItemSchema).max(500).optional(), // the plan the user is looking at

})
export type AssistantRequest = z.infer<typeof assistantRequestSchema>

// ---- Accounts and stored user data ----

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'A palavra-passe deve ter pelo menos 8 caracteres').max(128),
})
export type Credentials = z.infer<typeof credentialsSchema>

export interface User {
  id: string
  email: string
}

// What the server stores per user. Plans and chat are opaque here (they are outputs the client already
// received from the engine/assistant); the editable inputs are validated strictly.
export const userDataSchema = z.object({
  events: z.array(calendarEventSchema).max(500),
  activities: z.array(activitySchema).max(100),
  goals: z.array(goalSchema).max(100),
  preferences: preferencesSchema,
  plans: z.record(z.string(), z.unknown()),
  chat: z.array(z.unknown()).max(60),
})
export type UserData = z.infer<typeof userDataSchema>
