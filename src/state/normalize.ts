import type { AppState } from './store'
import { defaultPreferences, emptyState } from './seed'

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Turn stored data (server or legacy browser storage) into a complete AppState; missing/garbled parts fall back to defaults. */
export function normalizeState(raw: unknown): AppState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const plans = r.plans && typeof r.plans === 'object' && !Array.isArray(r.plans) ? (r.plans as AppState['plans']) : {}
  const prefs = r.preferences && typeof r.preferences === 'object' ? (r.preferences as Partial<AppState['preferences']>) : {}
  return {
    ...emptyState(),
    events: list(r.events),
    activities: list(r.activities),
    goals: list(r.goals),
    preferences: { ...defaultPreferences, ...prefs },
    plans,
    chat: list(r.chat),
  }
}
