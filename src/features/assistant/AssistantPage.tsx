import { useEffect, useRef, useState } from 'react'
import { formatDuration, WEEKDAYS_SHORT, weekdayOf } from '../../../shared/time'
import type { PlanningResult } from '../../../shared/domain'
import { Button, Card, Icon } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAssistant } from './useAssistant'

const SUGGESTIONS = [
  'Planeia a minha semana',
  'Planeia a próxima semana',
  'Quero estudar 6 horas esta semana e ir ao ginásio 4 vezes',
  'Consigo encaixar 3 horas de programação?',
  'Tenho um exame de Estruturas de Dados em 3 semanas',
  'Porque pões o ginásio nesses dias?',
  'Como aproveito o tempo de transporte?',
  'Tenho uma reunião na quinta às 15h, até às 16h',
]

export function AssistantPage() {
  const { state } = useStore()
  const { send, applyAndPlan, approvePlan, rejectPlan, busy } = useAssistant()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const names = new Map(state.activities.map((a) => [a.id, a.name]))

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat.length])

  const submit = (message: string) => {
    setText('')
    void send(message)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assistente</h1>
          <p className="muted">Diz o que queres fazer. O assistente interpreta; o motor de planeamento decide o que cabe.</p>
        </div>
      </div>
      <Card>
        <div className="chat">
          {state.chat.length === 0 && <p className="muted">Experimenta uma destas frases:</p>}
          {state.chat.map((m) => (
            <div key={m.id} style={{ display: 'contents' }}>
              <div className={`bubble ${m.role === 'user' ? 'user' : 'bot'}`}>{m.text}</div>
              {m.proposals && m.proposals.length > 0 && (
                <div className="proposal">
                  <b>Proposta</b>
                  {m.proposals.map((p, i) => <div key={i} className="small">• {p.summary}</div>)}
                  <div className="row">
                    <Button small disabled={m.handled} onClick={() => applyAndPlan(m)}>{m.handled ? 'Aplicado' : 'Aplicar e planear'}</Button>
                  </div>
                </div>
              )}
              {m.plan && m.planAdoptable && m.plan.scheduledItems.length > 0 && (
                <div className="proposal">
                  <b>Plano semanal proposto</b>
                  <PlanSummary plan={m.plan} names={names} />
                  {m.planDecision === 'approved' && <div className="small" style={{ color: 'var(--green)' }}>Aprovado e adicionado ao calendário.</div>}
                  {m.planDecision === 'rejected' && <div className="small muted">Rejeitado. Nada foi alterado no calendário.</div>}
                  {!m.planDecision && (
                    <div className="row">
                      <Button small onClick={() => approvePlan(m)}>Aprovar plano</Button>
                      <Button small variant="plain" onClick={() => rejectPlan(m)}>Rejeitar</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble bot muted">A pensar…</div>}
          <div ref={end} />
        </div>
        <div className="suggestions">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => submit(s)}>{s}</button>)}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(text) }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreve ao assistente…" maxLength={1000} />
          <Button icon disabled={busy || !text.trim()} aria-label="Enviar"><Icon name="send" size={18} /></Button>
        </form>
      </Card>
    </>
  )
}

/** The proposed week at a glance, day by day, so the user can decide without opening the calendar. */
function PlanSummary({ plan, names }: { plan: PlanningResult; names: Map<string, string> }) {
  const byDay = new Map<string, PlanningResult['scheduledItems']>()
  for (const i of plan.scheduledItems) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i])
  return (
    <>
      <div className="small muted">{formatDuration(plan.scheduledMinutes)} planeadas de {formatDuration(plan.requestedMinutes)} pedidas · {plan.scheduledItems.length} sessões</div>
      <ul className="tip-list small" style={{ marginTop: 0 }}>
        {[...byDay].map(([date, items]) => (
          <li key={date}>
            <b>{WEEKDAYS_SHORT[weekdayOf(date)]} {Number(date.slice(8))}:</b>{' '}
            {items.map((i) => `${names.get(i.activityId) ?? 'Atividade'} ${i.start}–${i.end}`).join(', ')}
          </li>
        ))}
      </ul>
    </>
  )
}
