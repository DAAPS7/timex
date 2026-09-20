import type { AppState } from './store'
import { defaultPreferences, emptyState } from './seed'

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Data saved before several transport modes were allowed has a single `mode`; turn it into `modes`. */
const withModes = <T extends { mode?: unknown; modes?: unknown }>(o: T): T => {
  if (Array.isArray(o.modes) && o.modes.length > 0) return o
  const { mode, ...rest } = o
  return { ...rest, modes: [mode ?? 'bus'] } as T
}

function upgradePlans(plans: AppState['plans']): AppState['plans'] {
  return Object.fromEntries(
    Object.entries(plans).map(([week, p]) => {
      const result = p?.result
      if (!result) return [week, p]
      return [week, { ...p, result: { ...result, commuteBlocks: list<any>(result.commuteBlocks).map(withModes) } }]
    }),
  )
}

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
    preferences: { ...defaultPreferences, ...prefs, ...(prefs.commute ? { commute: withModes(prefs.commute as any) } : {}) },
    plans: upgradePlans(plans),
    chat: list(r.chat),
  }
}
