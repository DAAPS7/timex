import { CONFLICT_TEXT, REASON_TEXT } from '../../../shared/reasons'
import { formatDuration, WEEKDAYS_LONG, weekdayOf } from '../../../shared/time'
import type { Activity, ConflictCode, PlanningResult, ScheduledItem } from '../../../shared/domain'
import type { AIProvider } from '../provider'
import type { ToolRunner } from '../tools'
import {
  INTENTS,
  normalize,
  parseActivity,
  parseDeadline,
  parseGoalTitle,
  splitClauses,
  type ParsedActivity,
} from './ruleBasedParser'

const HELP =
  'Posso criar atividades ("quero ir ao ginásio 4 vezes por semana, 1 hora"), objetivos ("tenho um exame de Algoritmos em 3 semanas"), ' +
  'planear a tua semana ("planeia a minha semana"), ver se algo cabe ("consigo encaixar 3 horas de programação?") e explicar o plano ("porque…?").'

const toDraft = (a: ParsedActivity) => ({ ...a, preferredDays: [] as number[] })
const dayName = (date: string) => WEEKDAYS_LONG[weekdayOf(date)]

function planSummary(plan: PlanningResult, names: Map<string, string>): string {
  const lines = [
    plan.status === 'fully_feasible'
      ? `Consegui encaixar tudo: ${formatDuration(plan.scheduledMinutes)} planeadas esta semana.`
      : `Só consegui encaixar ${formatDuration(plan.scheduledMinutes)} de ${formatDuration(plan.requestedMinutes)} pedidas.`,
  ]
  for (const c of plan.conflicts) {
    const code: ConflictCode = c.code
    lines.push(
      `• ${CONFLICT_TEXT[code]} para ${names.get(c.activityId) ?? c.activityId}: precisa de ${formatDuration(c.requestedMinutes)}, ` +
        `${formatDuration(c.scheduledMinutes)} encaixadas (${formatDuration(c.availableInWindowMinutes)} livres na janela).`,
    )
  }
  if (plan.conflicts.length > 0) {
    lines.push('Podes usar horários menos preferidos, reduzir outras atividades ou baixar o objetivo.')
  }
  return lines.join('\n')
}

function explain(items: ScheduledItem[], names: Map<string, string>, query: string): string {
  if (items.length === 0) return 'Ainda não há um plano visível. Pede-me "planeia a minha semana" primeiro.'
  const wanted = items.filter((i) => normalize(names.get(i.activityId) ?? '').split(' ').some((w) => w.length > 3 && query.includes(w)))
  const chosen = (wanted.length > 0 ? wanted : items).slice(0, 4)
  return chosen
    .map((i) => {
      const why = i.reasons.length > 0 ? i.reasons.map((r) => REASON_TEXT[r]).join(' ') : 'Foi o melhor intervalo livre disponível.'
      return `${names.get(i.activityId) ?? i.activityId} — ${dayName(i.date)} ${i.start}–${i.end}: ${why}`
    })
    .join('\n')
}

export const ruleBasedProvider: AIProvider = {
  async respond(message, tools: ToolRunner, { today }) {
    const text = normalize(message)
    const activities = tools.call('get_activities') as Activity[]
    const names = new Map(activities.map((a) => [a.id, a.name]))

    if (INTENTS.explain.test(text)) return explain(tools.call('explain_plan') as ScheduledItem[], names, text)

    const isFit = INTENTS.fit.test(text)
    if (INTENTS.goal.test(text) && !isFit) {
      const deadline = parseDeadline(message, today)
      if (!deadline) return 'Para quando é o prazo? (por exemplo "em 3 semanas" ou "2026-10-15")'
      tools.call('create_goal', { title: parseGoalTitle(message), deadline, priority: 'high' })
      return 'Propus este objetivo com prioridade alta. Não assumi quanto tempo de estudo precisas — diz-me, por exemplo, "estudar 6 horas por semana", e eu proponho a atividade.'
    }

    const parsed = splitClauses(message).map(parseActivity)
    const found = parsed.flatMap((p) => ('activity' in p ? [p.activity] : []))
    const needsAmount = parsed.find((p) => 'missing' in p && p.missing === 'amount')
    if (found.length === 0 && needsAmount && 'name' in needsAmount) {
      return `Quantas vezes por semana e durante quanto tempo queres fazer "${needsAmount.name}"?`
    }

    if (found.length > 0) {
      const created = found.map((a) => tools.call('create_activity', { ...toDraft(a), dryRun: isFit }) as Activity)
      const plan = tools.call('generate_plan') as PlanningResult
      const draftNames = new Map([...names, ...created.map((a) => [a.id, a.name] as const)])
      const intro = isFit ? 'Fiz a simulação sem alterar nada. ' : `Propus ${found.length} atividade(s) para aplicares. `
      return intro + planSummary(plan, draftNames)
    }

    if (INTENTS.plan.test(text)) {
      const plan = tools.call('generate_plan') as PlanningResult
      return planSummary(plan, names) + '\nVê a proposta abaixo e aceita-a, ou pede-me ajustes.'
    }

    if (INTENTS.availability.test(text)) {
      const free = tools.call('get_availability') as Record<string, number>
      const total = Object.values(free).reduce((n, m) => n + m, 0)
      const best = Object.entries(free).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
      return `Tens ${formatDuration(total)} livres esta semana (depois de compromissos fixos e sono). O dia mais livre é ${best ? `${dayName(best[0])} com ${formatDuration(best[1])}` : '—'}.`
    }

    return `Não percebi bem. ${HELP}`
  },
}
