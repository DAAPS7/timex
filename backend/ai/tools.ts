// Explicit, schema-validated tools. The AI layer can only reach application state through these.
// Read tools return facts; write tools only *propose* changes (the user applies them in the UI).
import { z } from 'zod'
import { TRANSPORT_LABEL, TRANSPORT_TIPS } from '../../shared/transport'
import { sleepMinutes } from '../../shared/routine'
import { addDays, WEEKDAYS_LONG, weekdayOf } from '../../shared/time'
import {
  activitySchema,
  calendarEventDraftSchema,
  goalSchema,
  type Activity,
  type CalendarEvent,
  type Goal,
  type PlanningInput,
  type PlanningResult,
  type ProposedAction,
  type ScheduledItem,
} from '../../shared/domain'
import { generatePlan } from '../domains/planning/engine'

export const TOOL_NAMES = [
  'get_activities',
  'get_goals',
  'get_availability',
  'get_routine',
  'create_activity',
  'create_goal',
  'create_event',
  'generate_plan',
  'explain_plan',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

const activityDraft = activitySchema.omit({ id: true }).extend({ dryRun: z.boolean().optional() })
const goalDraft = goalSchema.omit({ id: true })
const eventDraft = calendarEventDraftSchema
const noArgs = z.object({}).strict()
const weekArgs = z.object({ week: z.enum(['current', 'next']).optional() }).strict()

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Tool descriptions and argument schemas, for provider adapters that expose the tools to an LLM. */
export const TOOL_SPECS: Record<ToolName, { description: string; args: z.ZodType | null }> = {
  get_activities: { description: 'Lista as atividades que o utilizador já tem.', args: null },
  get_goals: { description: 'Lista os objetivos (com prazo) que o utilizador já tem.', args: null },
  get_availability: {
    description:
      'Minutos livres por dia (AAAA-MM-DD), depois de compromissos fixos, transporte e sono. Dias que já passaram e a parte de hoje que ' +
      'já passou contam 0. week="next" para a semana seguinte (por omissão, a semana atual).',
    args: weekArgs,
  },
  get_routine: {
    description:
      'Rotina do utilizador: horas de sono, transporte (modo, minutos por dia e ideias para o aproveitar) e compromissos fixos semanais.',
    args: null,
  },
  create_activity: {
    description:
      'Propõe criar ou atualizar uma atividade (o utilizador tem de a aceitar). Com dryRun=true apenas simula, ' +
      'sem propor nada (para perguntas do tipo "consigo encaixar…?"). Só usa valores que o utilizador disse.',
    args: activityDraft,
  },
  create_goal: { description: 'Propõe criar ou atualizar um objetivo com prazo (o utilizador tem de o aceitar).', args: goalDraft },
  create_event: {
    description:
      'Propõe um evento no calendário (reunião, exame, imprevisto; weekly=true só para horários fixos que se repetem). ' +
      'O utilizador tem de o aceitar. Depois de o propor, usa generate_plan para ver como o plano se ajusta.',
    args: eventDraft,
  },
  generate_plan: {
    description:
      'Executa o motor de planeamento para uma semana, incluindo as atividades/objetivos propostos nesta conversa. O resultado é uma ' +
      'PROPOSTA de plano semanal que o utilizador aprova ou rejeita. week="next" para a semana seguinte (por omissão, a semana atual).',
    args: weekArgs,
  },
  explain_plan: { description: 'Devolve as sessões do plano que o utilizador está a ver, com os motivos de cada uma.', args: null },
}

export interface ToolRunner {
  call(name: ToolName, args?: unknown): unknown
  readonly proposals: ProposedAction[]
  readonly plan?: PlanningResult
  readonly planWeekStart?: string
  readonly hasDrafts: boolean
}

export function createToolRunner(state: PlanningInput, currentItems: ScheduledItem[] = []): ToolRunner {
  // Proposed (and dry-run) changes are layered over the real state so plans can preview them.
  const draftActivities: Activity[] = []
  const draftGoals: Goal[] = []
  const draftEvents: CalendarEvent[] = []
  const proposals: ProposedAction[] = []
  let plan: PlanningResult | undefined
  let planWeekStart: string | undefined

  const weekStartFor = (week: 'current' | 'next' | undefined) => (week === 'next' ? addDays(state.weekStart, 7) : state.weekStart)

  const withDrafts = (week: 'current' | 'next' | undefined): PlanningInput => ({
    ...state,
    weekStart: weekStartFor(week),
    activities: [...state.activities.filter((a) => !draftActivities.some((d) => d.id === a.id)), ...draftActivities],
    goals: [...state.goals.filter((g) => !draftGoals.some((d) => d.id === g.id)), ...draftGoals],
    events: [...state.events.filter((e) => !draftEvents.some((d) => d.id === e.id)), ...draftEvents],
    // with the current week's plan on screen, replan around what changed instead of starting from scratch
    ...(currentItems.length > 0 && week !== 'next' ? { previousItems: currentItems } : {}),
  })

  return {
    proposals,
    get plan() {
      return plan
    },
    get planWeekStart() {
      return planWeekStart
    },
    get hasDrafts() {
      return draftActivities.length + draftGoals.length + draftEvents.length > 0
    },
    call(name, args = {}) {
      switch (name) {
        case 'get_activities':
          noArgs.parse(args)
          return state.activities
        case 'get_goals':
          noArgs.parse(args)
          return state.goals
        case 'get_availability': {
          const { week } = weekArgs.parse(args)
          const { availableMinutesByDay } = generatePlan({ ...state, weekStart: weekStartFor(week), activities: [] })
          return availableMinutesByDay
        }
        case 'get_routine': {
          noArgs.parse(args)
          const { dayStart, dayEnd, commute } = state.preferences
          return {
            sleep: { wakeTime: dayStart, bedTime: dayEnd, sleepHours: Math.round((sleepMinutes(state.preferences) / 60) * 10) / 10 },
            commute: commute && commute.minutesPerDay > 0
              ? {
                modes: commute.modes.map((m) => TRANSPORT_LABEL[m]),
                minutesPerDay: commute.minutesPerDay,
                ideasToUseTheTime: [...new Set(commute.modes.flatMap((m) => TRANSPORT_TIPS[m]))],
              }
              : null,
            fixedCommitments: state.events
              .filter((e) => e.weekly)
              .map((e) => ({ title: e.title, weekday: WEEKDAYS_LONG[weekdayOf(e.date)], start: e.start, end: e.end })),
          }
        }
        case 'create_activity': {
          const { dryRun, ...draft } = activityDraft.parse(args)
          const existing = state.activities.find((a) => a.name.toLowerCase() === draft.name.toLowerCase())
          const activity: Activity = { ...draft, id: existing?.id ?? `a-${slug(draft.name)}` }
          draftActivities.push(activity)
          if (!dryRun) {
            proposals.push({
              type: 'create_activity',
              summary: `${existing ? 'Atualizar' : 'Criar'} atividade "${activity.name}": ${activity.sessionsPerWeek}× ${activity.sessionMinutes} min por semana`,
              payload: activity,
            })
          }
          return activity
        }
        case 'create_goal': {
          const draft = goalDraft.parse(args)
          const existing = state.goals.find((g) => g.title.toLowerCase() === draft.title.toLowerCase())
          const goal: Goal = { ...draft, id: existing?.id ?? `g-${slug(draft.title)}` }
          draftGoals.push(goal)
          proposals.push({
            type: 'create_goal',
            summary: `${existing ? 'Atualizar' : 'Criar'} objetivo "${goal.title}" com prazo ${goal.deadline}`,
            payload: goal,
          })
          return goal
        }
        case 'create_event': {
          const draft = eventDraft.parse(args)
          const event: CalendarEvent = { ...draft, id: `ev-${slug(draft.title)}-${draft.date}` }
          draftEvents.push(event)
          proposals.push({
            type: 'create_event',
            summary: `Adicionar "${event.title}" em ${event.date}, ${event.start}–${event.end}${event.weekly ? ' (todas as semanas)' : ''}`,
            payload: event,
          })
          return event
        }
        case 'generate_plan': {
          const { week } = weekArgs.parse(args)
          plan = generatePlan(withDrafts(week))
          planWeekStart = weekStartFor(week)
          return plan
        }
        case 'explain_plan': {
          noArgs.parse(args)
          return currentItems
        }
      }
    },
  }
}
