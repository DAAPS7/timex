// Explicit, schema-validated tools. The AI layer can only reach application state through these.
// Read tools return facts; write tools only *propose* changes (the user applies them in the UI).
import { z } from 'zod'
import {
  activitySchema,
  goalSchema,
  type Activity,
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
  'create_activity',
  'create_goal',
  'generate_plan',
  'explain_plan',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

const activityDraft = activitySchema.omit({ id: true }).extend({ dryRun: z.boolean().optional() })
const goalDraft = goalSchema.omit({ id: true })
const noArgs = z.object({}).strict()

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Tool descriptions and argument schemas, for provider adapters that expose the tools to an LLM. */
export const TOOL_SPECS: Record<ToolName, { description: string; args: z.ZodType | null }> = {
  get_activities: { description: 'Lista as atividades que o utilizador já tem.', args: null },
  get_goals: { description: 'Lista os objetivos (com prazo) que o utilizador já tem.', args: null },
  get_availability: {
    description: 'Minutos livres por dia (AAAA-MM-DD) nesta semana, depois de compromissos fixos e sono.',
    args: null,
  },
  create_activity: {
    description:
      'Propõe criar ou atualizar uma atividade (o utilizador tem de a aceitar). Com dryRun=true apenas simula, ' +
      'sem propor nada (para perguntas do tipo "consigo encaixar…?"). Só usa valores que o utilizador disse.',
    args: activityDraft,
  },
  create_goal: { description: 'Propõe criar ou atualizar um objetivo com prazo (o utilizador tem de o aceitar).', args: goalDraft },
  generate_plan: {
    description: 'Executa o motor de planeamento para a semana atual, incluindo as atividades/objetivos propostos nesta conversa.',
    args: null,
  },
  explain_plan: { description: 'Devolve as sessões do plano que o utilizador está a ver, com os motivos de cada uma.', args: null },
}

export interface ToolRunner {
  call(name: ToolName, args?: unknown): unknown
  readonly proposals: ProposedAction[]
  readonly plan?: PlanningResult
  readonly hasDrafts: boolean
}

export function createToolRunner(state: PlanningInput, currentItems: ScheduledItem[] = []): ToolRunner {
  // Proposed (and dry-run) changes are layered over the real state so plans can preview them.
  const draftActivities: Activity[] = []
  const draftGoals: Goal[] = []
  const proposals: ProposedAction[] = []
  let plan: PlanningResult | undefined

  const withDrafts = (): PlanningInput => ({
    ...state,
    activities: [...state.activities.filter((a) => !draftActivities.some((d) => d.id === a.id)), ...draftActivities],
    goals: [...state.goals.filter((g) => !draftGoals.some((d) => d.id === g.id)), ...draftGoals],
  })

  return {
    proposals,
    get plan() {
      return plan
    },
    get hasDrafts() {
      return draftActivities.length + draftGoals.length > 0
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
          noArgs.parse(args)
          const { availableMinutesByDay } = generatePlan({ ...state, activities: [] })
          return availableMinutesByDay
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
        case 'generate_plan': {
          noArgs.parse(args)
          plan = generatePlan(withDrafts())
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
