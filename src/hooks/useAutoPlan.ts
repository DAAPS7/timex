import { useEffect, useRef } from 'react'
import { addDays, todayLocal } from '../../shared/time'
import { useStore } from '../state/store'
import { usePlanning } from './usePlanning'

/**
 * Every week gets a plan without the user asking: when a week has none (and is not in the past) a proposal is
 * generated for it. Each week is tried once per session, so a failing request cannot loop.
 */
export function useAutoPlan(weekStart: string, enabled = true) {
  const { state } = useStore()
  const { generate } = usePlanning()
  const tried = useRef(new Set<string>())
  const hasPlan = !!state.plans[weekStart]
  const canPlan = enabled && state.activities.length > 0

  useEffect(() => {
    if (hasPlan || !canPlan || addDays(weekStart, 6) < todayLocal() || tried.current.has(weekStart)) return
    tried.current.add(weekStart)
    void generate(weekStart)
  }, [weekStart, hasPlan, canPlan, generate])
}
