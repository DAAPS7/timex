// Tiny PT/EN natural-language interpreter used by the offline provider. It only extracts what the
// user literally said; anything missing is asked back instead of guessed (product spec §12).
import { addDays } from '../../../shared/time'
import type { Priority } from '../../../shared/domain'

const NUMBER_WORDS: Record<string, string> = {
  um: '1', uma: '1', one: '1', once: '1 vez', dois: '2', duas: '2', two: '2', twice: '2 vezes', tres: '3', three: '3',
  quatro: '4', four: '4', cinco: '5', five: '5', seis: '6', six: '6', sete: '7', seven: '7', oito: '8', eight: '8',
  nove: '9', nine: '9', dez: '10', ten: '10',
}

export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\b[a-z]+\b/g, (w) => NUMBER_WORDS[w] ?? w)

const ACTIVITY_NAMES: [RegExp, string][] = [
  [/ginasio|gym|treino|workout/, 'Ginásio'],
  [/estud|study/, 'Estudar'],
  [/program|coding|codigo|\bcode\b/, 'Programar'],
  [/\bler\b|leitura|reading|\bread\b/, 'Ler'],
  [/corr(er|ida)|running|\brun\b/, 'Correr'],
  [/medit/, 'Meditar'],
  [/guitarra|piano|musica|music/, 'Música'],
  [/projeto|project/, 'Projeto pessoal'],
]

export interface ParsedActivity {
  name: string
  sessionsPerWeek: number
  sessionMinutes: number
  priority: Priority
  preferredStart?: string
  preferredEnd?: string
}

export type ActivityParse = { activity: ParsedActivity } | { missing: 'name' | 'amount'; name?: string }

const SESSION_DEFAULT = 60
const SESSION_FOR_TOTALS = 90

function amounts(text: string) {
  const sessions = text.match(/(\d+)\s*(?:vezes|vez|x|times|time)\b/)
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|horas?|hours?|hrs?)/)
  const mins = text.match(/(\d+)\s*(?:min\b|minutos?|minutes?)/)
  const minutes = hours ? Math.round(parseFloat(hours[1].replace(',', '.')) * 60) : mins ? Number(mins[1]) : undefined
  return { sessions: sessions ? Number(sessions[1]) : undefined, minutes }
}

function timeOfDay(text: string): Pick<ParsedActivity, 'preferredStart' | 'preferredEnd'> {
  if (/de manha|morning/.test(text)) return { preferredStart: '08:00', preferredEnd: '12:00' }
  if (/a tarde|afternoon/.test(text)) return { preferredStart: '14:00', preferredEnd: '18:00' }
  if (/a noite|evening|night/.test(text)) return { preferredStart: '18:00', preferredEnd: '21:30' }
  return {}
}

/** Parse one clause such as "estudar 6 horas esta semana" or "gym 4 vezes por semana, 1 hora". */
export function parseActivity(clause: string): ActivityParse {
  const text = normalize(clause)
  const name = ACTIVITY_NAMES.find(([re]) => re.test(text))?.[1]
  if (!name) return { missing: 'name' }
  const { sessions, minutes } = amounts(text)
  const priority: Priority = /importante|prioridade|priority|urgente/.test(text) ? 'high' : 'medium'
  const extras = { priority, ...timeOfDay(text) }

  if (sessions && minutes) return { activity: { name, sessionsPerWeek: sessions, sessionMinutes: minutes, ...extras } }
  if (sessions) return { activity: { name, sessionsPerWeek: sessions, sessionMinutes: SESSION_DEFAULT, ...extras } }
  if (minutes) {
    // A bare duration is a weekly total ("6 horas esta semana"): split it into sessions.
    const sessionMinutes = Math.min(minutes, SESSION_FOR_TOTALS)
    return { activity: { name, sessionsPerWeek: Math.ceil(minutes / sessionMinutes), sessionMinutes, ...extras } }
  }
  return { missing: 'amount', name }
}

/** Split "quero estudar 6 horas e ir ao ginásio 4 vezes" into clauses. */
export const splitClauses = (message: string): string[] =>
  message.split(/\s+e\s+|\s+and\s+|[,;]\s*(?=\S)/i).filter((c) => c.trim().length > 0)

export function parseDeadline(message: string, today: string): string | undefined {
  const text = normalize(message)
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  const dm = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/)
  if (dm) {
    const year = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4))
    const candidate = `${year}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
    return !dm[3] && candidate < today ? `${year + 1}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : candidate
  }
  const rel = text.match(/(?:em|in|daqui a)\s+(\d+)\s*(semanas?|weeks?|dias?|days?)/)
  if (rel) return addDays(today, Number(rel[1]) * (/^(sem|week)/.test(rel[2]) ? 7 : 1))
  return undefined
}

export function parseGoalTitle(message: string): string {
  const m = message.toLowerCase().match(/(exame|prova|teste|exam)\s+(?:de\s+|of\s+)?([\p{L} ]+?)(?:\s+(?:em|in|no|dia|daqui|para|and|e)\b|[,.!?\d]|$)/u)
  const kind = m ? (m[1] === 'exam' ? 'Exame' : m[1][0].toUpperCase() + m[1].slice(1)) : 'Exame'
  const topic = m?.[2]?.trim()
  return topic ? `${kind} de ${topic[0].toUpperCase()}${topic.slice(1)}` : kind
}

export const INTENTS = {
  explain: /\b(porque|why|explica|explain)\b/,
  fit: /\b(posso|consigo|cabe|caber|encaixar|encaixo|can i|could i|fit)\b/,
  goal: /\b(exame|exam|prova|teste|prazo|deadline|entrega)\b/,
  plan: /\b(planeia|planear|planeamento|plano|plan|organiza|organizar|gera|gerar|generate)\b/,
  availability: /\b(livre|disponivel|disponibilidade|available|free)\b/,
}
