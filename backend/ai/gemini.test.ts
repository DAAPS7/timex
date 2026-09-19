import { describe, expect, it, vi } from 'vitest'
import type { PlanningInput } from '../../shared/domain'
import { handleAssistantMessage } from './assistantService'
import { createGeminiProvider } from './providers/gemini'

const state: PlanningInput = {
  today: '2026-09-14', weekStart: '2026-09-14', events: [], goals: [], activities: [],
  preferences: { timezone: 'Europe/Lisbon', dayStart: '08:00', dayEnd: '22:00', minBreakMinutes: 15, maxDailyPlannedMinutes: 480 },
}

const reply = (parts: unknown[]) => new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] }))

describe('gemini provider', () => {
  it('runs the tools Gemini asks for and returns its final text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply([{ functionCall: { name: 'create_activity', args: { name: 'Gym', sessionsPerWeek: 2, sessionMinutes: 60, priority: 'medium' } } }]))
      .mockResolvedValueOnce(reply([{ functionCall: { name: 'generate_plan', args: {} } }]))
      .mockResolvedValueOnce(reply([{ text: 'Propus o Gym 2x por semana.' }]))
    const r = await handleAssistantMessage({ message: 'gym duas vezes', state }, {}, createGeminiProvider('key', 'm', fetchMock))

    expect(r.reply).toBe('Propus o Gym 2x por semana.')
    expect(r.proposals).toHaveLength(1)
    expect(r.plan?.scheduledItems).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/m:generateContent')
    expect(init.headers['x-goog-api-key']).toBe('key')
    // tool results are sent back to the model as functionResponse parts
    const third = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(third.contents.at(-1).parts[0].functionResponse.name).toBe('generate_plan')
  })

  it('reports invalid tool arguments back to the model instead of failing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply([{ functionCall: { name: 'create_activity', args: { name: 'Gym' } } }]))
      .mockResolvedValueOnce(reply([{ text: 'Quantas vezes por semana?' }]))
    const r = await handleAssistantMessage({ message: 'gym', state }, {}, createGeminiProvider('key', 'm', fetchMock))
    expect(r.reply).toBe('Quantas vezes por semana?')
    expect(r.proposals).toHaveLength(0)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(second.contents.at(-1).parts[0].functionResponse.response.error).toBeDefined()
  })

  it('falls back to the rule-based assistant when Gemini fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
    const r = await handleAssistantMessage({ message: 'quero ir ao ginásio 3 vezes', state }, {}, createGeminiProvider('key', 'm', fetchMock))
    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0].summary).toContain('Ginásio')
  })

  it('uses the rule-based assistant when no key is configured', async () => {
    const r = await handleAssistantMessage({ message: 'quero ir ao ginásio 3 vezes', state }, {})
    expect(r.proposals).toHaveLength(1)
  })
})
