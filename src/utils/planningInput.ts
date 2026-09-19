import type { Activity, Goal, PlanningInput, ProposedAction } from '../../shared/domain'
import type { AppState } from '../state/store'

/** Assemble the API payload from app data. No scheduling logic here; that lives in the backend engine. */
export const buildPlanningInput = (state: AppState, weekStart: string, today: string): PlanningInput => ({
  today,
  weekStart,
  events: state.events,
  activities: state.activities,
  goals: state.goals,
  preferences: state.preferences,
})

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

export function applyProposals(state: AppState, proposals: ProposedAction[]): AppState {
  let activities: Activity[] = state.activities
  let goals: Goal[] = state.goals
  for (const p of proposals) {
    if (p.type === 'create_activity') activities = upsert(activities, p.payload)
    else goals = upsert(goals, p.payload)
  }
  return { ...state, activities, goals }
}
