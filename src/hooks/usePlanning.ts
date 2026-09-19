import { useCallback, useState } from 'react'
import { todayLocal } from '../../shared/time'
import type { PlanningResult } from '../../shared/domain'
import { planningApi } from '../services/api/client'
import { useStore, type AppState } from '../state/store'
import { buildPlanningInput } from '../utils/planningInput'

export function usePlanning() {
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adopt = useCallback(
    (weekStart: string, result: PlanningResult) => {
      const version = (state.plans[weekStart]?.version ?? 0) + 1
      dispatch({
        type: 'setPlan',
        plan: { id: `plan-${weekStart}`, weekStart, status: 'proposed', version, createdAt: new Date().toISOString(), result },
      })
    },
    [state.plans, dispatch],
  )

  /** Ask the backend planning engine for a proposed plan; `override` lets callers plan on not-yet-committed data. */
  const generate = useCallback(
    async (weekStart: string, override?: AppState) => {
      setBusy(true)
      setError(null)
      try {
        adopt(weekStart, await planningApi.generate(buildPlanningInput(override ?? state, weekStart, todayLocal())))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido')
      } finally {
        setBusy(false)
      }
    },
    [state, adopt],
  )

  return { generate, adopt, busy, error }
}
