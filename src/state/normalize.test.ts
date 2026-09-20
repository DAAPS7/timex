import { describe, expect, it } from 'vitest'
import { normalizeState } from './normalize'

describe('normalizeState', () => {
  it('upgrades the single transport mode saved by older versions, in preferences and in stored plans', () => {
    const s = normalizeState({
      preferences: { commute: { mode: 'train', minutesPerDay: 60 } },
      plans: { '2026-09-14': { result: { commuteBlocks: [{ date: '2026-09-14', start: '08:00', end: '08:30', mode: 'bus' }] } } },
    })
    expect(s.preferences.commute).toEqual({ modes: ['train'], minutesPerDay: 60 })
    expect(s.plans['2026-09-14'].result.commuteBlocks![0].modes).toEqual(['bus'])
  })
})
