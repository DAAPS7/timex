import { useState } from 'react'
import { startOfWeek, todayLocal } from '../../../shared/time'
import { usePlanning } from '../../hooks/usePlanning'
import { assistantApi } from '../../services/api/client'
import { useStore, type ChatMessage } from '../../state/store'
import { newId } from '../../utils/ids'
import { applyProposals, buildPlanningInput } from '../../utils/planningInput'

/** Client side of the assistant: sends messages to /api/assistant/message and applies confirmed proposals. */
export function useAssistant() {
  const { state, dispatch } = useStore()
  const { generate, adopt } = usePlanning()
  const [busy, setBusy] = useState(false)
  const weekStart = startOfWeek(todayLocal())

  const send = async (message: string) => {
    if (!message.trim() || busy) return
    setBusy(true)
    dispatch({ type: 'chat', message: { id: newId('m'), role: 'user', text: message } })
    try {
      const items = state.plans[weekStart]?.result.scheduledItems
      const r = await assistantApi.send(message, buildPlanningInput(state, weekStart, todayLocal()), items)
      dispatch({ type: 'chat', message: { id: newId('m'), role: 'assistant', text: r.reply, proposals: r.proposals, plan: r.plan, planAdoptable: r.planAdoptable, planWeekStart: r.planWeekStart } })
    } catch (e) {
      dispatch({ type: 'chat', message: { id: newId('m'), role: 'assistant', text: e instanceof Error ? e.message : 'Algo correu mal.' } })
    } finally {
      setBusy(false)
    }
  }

  // Nothing changes until the user confirms (product principle 2.2).
  const applyAndPlan = async (m: ChatMessage) => {
    dispatch({ type: 'markHandled', messageId: m.id })
    for (const p of m.proposals ?? []) {
      if (p.type === 'create_activity') dispatch({ type: 'upsertActivity', activity: p.payload })
      else if (p.type === 'create_goal') dispatch({ type: 'upsertGoal', goal: p.payload })
      else dispatch({ type: 'upsertEvent', event: p.payload })
    }
    // a plan is already on screen: keep what still works and move only what the new items disturb
    await generate(m.planWeekStart ?? weekStart, applyProposals(state, m.proposals ?? []), { stable: true })
  }

  // The assistant only proposes a weekly plan; it enters the calendar as accepted when the user approves it.
  const approvePlan = (m: ChatMessage) => {
    if (!m.plan) return
    dispatch({ type: 'decidePlan', messageId: m.id, decision: 'approved' })
    adopt(m.planWeekStart ?? weekStart, m.plan, 'accepted')
  }

  const rejectPlan = (m: ChatMessage) => dispatch({ type: 'decidePlan', messageId: m.id, decision: 'rejected' })

  return { send, applyAndPlan, approvePlan, rejectPlan, busy }
}
