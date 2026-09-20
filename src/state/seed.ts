import { addDays, startOfWeek, todayLocal } from '../../shared/time'
import type { CalendarEvent } from '../../shared/domain'
import type { AppState } from './store'

export const defaultPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Lisbon',
  dayStart: '08:00',
  dayEnd: '22:00',
  minBreakMinutes: 15,
  maxDailyPlannedMinutes: 480,
  essentials: [
    { id: 'ess-almoco', title: 'Almoço', start: '12:30', end: '13:30', kind: 'meal' as const },
    { id: 'ess-jantar', title: 'Jantar', start: '19:30', end: '20:30', kind: 'meal' as const },
  ],
}

export const emptyState = (): AppState => ({
  events: [], activities: [], goals: [], preferences: defaultPreferences, plans: {}, chat: [],
})

/** Demo data relative to the current week so the first plan is meaningful straight away. */
export function seedState(): AppState {
  const monday = startOfWeek(todayLocal())
  const event = (id: string, title: string, day: number, start: string, end: string, weekly = true): CalendarEvent => ({
    id, title, date: addDays(monday, day), start, end, weekly,
  })
  const events = [
    ...[0, 1, 2, 3].map((d) => event(`uni-${d}`, 'Universidade', d, '09:00', '13:00')),
    event('work-4', 'Trabalho', 4, '14:00', '18:00'),
    event('doc-3', 'Consulta', 3, '16:00', '17:00', false),
  ]
  return {
    ...emptyState(),
    events,
    goals: [{ id: 'g-exame', title: 'Exame de Algoritmos', deadline: addDays(monday, 18), priority: 'high' }],
    activities: [
      { id: 'a-algoritmos', name: 'Estudar Algoritmos', sessionsPerWeek: 4, sessionMinutes: 90, priority: 'high', preferredDays: [], preferredStart: '14:00', preferredEnd: '18:00', goalId: 'g-exame' },
      { id: 'a-gym', name: 'Ginásio', sessionsPerWeek: 3, sessionMinutes: 60, priority: 'medium', preferredDays: [0, 2, 5], preferredStart: '17:00', preferredEnd: '21:00' },
      { id: 'a-projeto', name: 'Projeto pessoal', sessionsPerWeek: 2, sessionMinutes: 90, priority: 'low', preferredDays: [], preferredStart: '18:00', preferredEnd: '21:30' },
      { id: 'a-ler', name: 'Ler', sessionsPerWeek: 3, sessionMinutes: 30, priority: 'low', preferredDays: [], preferredStart: '21:00', preferredEnd: '22:00' },
    ],
  }
}
