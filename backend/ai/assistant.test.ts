import { describe, expect, it } from 'vitest'
import type { PlanningInput } from '../../shared/domain'
import { handleAssistantMessage } from './assistantService'

const state: PlanningInput = {
  today: '2026-09-14', weekStart: '2026-09-14', events: [], goals: [],
  activities: [{ id: 'a-gym', name: 'Ginásio', sessionsPerWeek: 3, sessionMinutes: 60, priority: 'medium', preferredDays: [] }],
  preferences: { timezone: 'Europe/Lisbon', dayStart: '08:00', dayEnd: '22:00', minBreakMinutes: 15, maxDailyPlannedMinutes: 480 },
}
const ask = (message: string) => handleAssistantMessage({ message, state })

describe('assistant (rule-based provider)', () => {
  it('turns a two-part request into proposals and a feasibility preview', async () => {
    const r = await ask('Quero estudar seis horas esta semana e ir ao ginásio quatro vezes')
    expect(r.proposals.map((p) => p.summary).join()).toContain('Estudar')
    expect(r.proposals).toHaveLength(2)
    expect(r.plan?.status).toBe('fully_feasible')
  })
  it('answers "can I fit" without proposing changes', async () => {
    const r = await ask('Consigo encaixar 3 horas de programação esta semana?')
    expect(r.proposals).toHaveLength(0)
    expect(r.plan).toBeDefined()
  })
  it('asks for missing information instead of guessing', async () => {
    expect((await ask('quero começar a correr')).reply).toContain('Quantas vezes')
    expect((await ask('tenho um exame de Algoritmos')).reply).toContain('prazo')
  })
  it('proposes a goal with a relative deadline', async () => {
    const r = await ask('Tenho um exame de Algoritmos em 3 semanas')
    expect(r.proposals[0]).toMatchObject({ type: 'create_goal', payload: { deadline: '2026-10-05', title: 'Exame de Algoritmos' } })
  })
})
