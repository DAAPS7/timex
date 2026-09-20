import { useCallback, useState } from 'react'
import { addDays, startOfWeek, todayLocal } from '../../shared/time'
import type { Plan, PlanningResult } from '../../shared/domain'
import { planningApi } from '../services/api/client'
import { useStore, type AppState } from '../state/store'
import { buildPlanningInput } from '../utils/planningInput'

export function usePlanning() {
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adopt = useCallback(
    (weekStart: string, result: PlanningResult, status: Plan['status'] = 'proposed') => {
      const version = (state.plans[weekStart]?.version ?? 0) + 1
      dispatch({
        type: 'setPlan',
        plan: { id: `plan-${weekStart}`, weekStart, status, version, createdAt: new Date().toISOString(), result },
      })
    },
    [state.plans, dispatch],
  )

  /**
   * Ask the backend planning engine for a proposed plan. `override` plans on not-yet-committed data.
   * With `stable`, sessions of the current plan that are still valid stay where they are (used after one-off events).
   */
  const generate = useCallback(
    async (weekStart: string, override?: AppState, opts: { stable?: boolean } = {}) => {
      setBusy(true)
      setError(null)
      try {
        const source = override ?? state
        const previous = opts.stable ? state.plans[weekStart]?.result.scheduledItems : undefined
        adopt(weekStart, await planningApi.generate(buildPlanningInput(source, weekStart, todayLocal(), previous)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido')
      } finally {
        setBusy(false)
      }
    },
    [state, adopt],
  )

  /**
   * After the routine or the calendar changed (`next` is the new data): revise every current/future week that
   * already has a plan, keeping what still works. The result is a proposal the user reviews.
   */
  const replanAffected = useCallback(
    async (next: AppState) => {
      const thisWeek = startOfWeek(todayLocal())
      const weeks = Object.keys(state.plans).filter((w) => addDays(w, 6) >= todayLocal() && w >= thisWeek).sort()
      for (const week of weeks) {
        const previous = state.plans[week]?.result.scheduledItems
        try {
          const result = await planningApi.generate(buildPlanningInput(next, week, todayLocal(), previous))
          dispatch({
            type: 'setPlan',
            plan: { id: `plan-${week}`, weekStart: week, status: 'proposed', version: (state.plans[week]?.version ?? 0) + 1, createdAt: new Date().toISOString(), result },
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro desconhecido')
        }
      }
    },
    [state.plans, dispatch],
  )

  return { generate, adopt, replanAffected, busy, error }
}
