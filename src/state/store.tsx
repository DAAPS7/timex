import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Activity, CalendarEvent, Goal, Plan, PlanningResult, Preferences, ProposedAction } from '../../shared/domain'
import { loadState, saveState } from '../services/api/storage'
import { seedState } from './seed'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  proposals?: ProposedAction[]
  plan?: PlanningResult
  planAdoptable?: boolean // the plan was built from real data only (no hypothetical activities)
  handled?: boolean // the user already applied the proposals / adopted the plan
}

export interface AppState {
  events: CalendarEvent[]
  activities: Activity[]
  goals: Goal[]
  preferences: Preferences
  plans: Record<string, Plan> // by weekStart
  chat: ChatMessage[]
}

export type Action =
  | { type: 'upsertEvent'; event: CalendarEvent }
  | { type: 'deleteEvent'; id: string }
  | { type: 'upsertActivity'; activity: Activity }
  | { type: 'deleteActivity'; id: string }
  | { type: 'upsertGoal'; goal: Goal }
  | { type: 'deleteGoal'; id: string }
  | { type: 'setPreferences'; preferences: Preferences }
  | { type: 'setPlan'; plan: Plan }
  | { type: 'acceptPlan'; weekStart: string }
  | { type: 'removeScheduledItem'; weekStart: string; itemId: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'markHandled'; messageId: string }
  | { type: 'replace'; state: AppState }

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'upsertEvent': return { ...s, events: upsert(s.events, a.event) }
    case 'deleteEvent': return { ...s, events: s.events.filter((e) => e.id !== a.id) }
    case 'upsertActivity': return { ...s, activities: upsert(s.activities, a.activity) }
    case 'deleteActivity': return { ...s, activities: s.activities.filter((x) => x.id !== a.id) }
    case 'upsertGoal': return { ...s, goals: upsert(s.goals, a.goal) }
    case 'deleteGoal':
      return {
        ...s,
        goals: s.goals.filter((g) => g.id !== a.id),
        activities: s.activities.map((x) => (x.goalId === a.id ? { ...x, goalId: undefined } : x)),
      }
    case 'setPreferences': return { ...s, preferences: a.preferences }
    case 'setPlan': return { ...s, plans: { ...s.plans, [a.plan.weekStart]: a.plan } }
    case 'acceptPlan': {
      const p = s.plans[a.weekStart]
      return p ? { ...s, plans: { ...s.plans, [a.weekStart]: { ...p, status: 'accepted' } } } : s
    }
    case 'removeScheduledItem': {
      const p = s.plans[a.weekStart]
      if (!p) return s
      const items = p.result.scheduledItems.filter((i) => i.id !== a.itemId)
      const result = { ...p.result, scheduledItems: items }
      return { ...s, plans: { ...s.plans, [a.weekStart]: { ...p, status: 'modified', version: p.version + 1, result } } }
    }
    case 'chat': return { ...s, chat: [...s.chat, a.message].slice(-60) }
    case 'markHandled':
      return { ...s, chat: s.chat.map((m) => (m.id === a.messageId ? { ...m, handled: true } : m)) }
    case 'replace': return a.state
  }
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? seedState())
  useEffect(() => saveState(state), [state])
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
