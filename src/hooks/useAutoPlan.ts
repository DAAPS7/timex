import { useEffect, useRef } from 'react'
import { addDays, todayLocal } from '../../shared/time'
import { useStore } from '../state/store'
import { usePlanning } from './usePlanning'

/**
 * Every visible week gets a plan without the user asking: when a week has none (and is not in the past) a proposal is
 * generated for it. Each week is tried once per session, so a failing request cannot loop.
 */
export function useAutoPlan(weekStarts: string[], enabled = true) {
  const { state } = useStore()
  const { generate } = usePlanning()
  const tried = useRef(new Set<string>())
  const canPlan = enabled && state.activities.length > 0
  const key = weekStarts.join(',')

  useEffect(() => {
    if (!canPlan) return
    for (const week of key.split(',')) {
      if (state.plans[week] || addDays(week, 6) < todayLocal() || tried.current.has(week)) continue
      tried.current.add(week)
      void generate(week)
    }
  }, [key, canPlan, state.plans, generate])
}
