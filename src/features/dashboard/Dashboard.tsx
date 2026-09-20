import { useEffect, useState } from 'react'
import { daysBetween, formatDuration, nowLocalMinutes, startOfWeek, todayLocal, toMinutes, WEEKDAYS_LONG, weekdayOf } from '../../../shared/time'
import { occursOn } from '../../../shared/events'
import { TRANSPORT_LABEL, TRANSPORT_TIPS } from '../../../shared/transport'
import { Button, Card, CardHead, Empty, Icon } from '../../components/ui'
import type { Page } from '../../components/layout/AppShell'
import { usePlanning } from '../../hooks/usePlanning'
import { planningApi } from '../../services/api/client'
import { useStore } from '../../state/store'
import { colorFor } from '../../utils/colors'
import { buildPlanningInput } from '../../utils/planningInput'
import { useAssistant } from '../assistant/useAssistant'

interface Row { key: string; start: string; end: string; title: string; color: string; fixed: boolean }

export function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { state } = useStore()
  const { generate, busy } = usePlanning()
  const { send } = useAssistant()
  const [text, setText] = useState('')
  const [freeToday, setFreeToday] = useState<number | null>(null)
  const today = todayLocal()
  const weekStart = startOfWeek(today)
  const plan = state.plans[weekStart]
  const names = new Map(state.activities.map((a) => [a.id, a.name]))

  // Availability is derived by the backend engine (run with no activities), never computed in the UI.
  useEffect(() => {
    planningApi
      .generate({ ...buildPlanningInput(state, weekStart, today), activities: [] })
      .then((r) => setFreeToday(r.availableMinutesByDay[today] ?? 0))
      .catch(() => setFreeToday(null))
  }, [state.events, state.preferences, weekStart, today])

  const todayItems = plan?.result.scheduledItems.filter((i) => i.date === today) ?? []
  const plannedToday = todayItems.reduce((n, i) => n + toMinutes(i.end) - toMinutes(i.start), 0)
  // Fresh availability (already excludes what has elapsed) minus the planned sessions that are still ahead.
  const now = nowLocalMinutes()
  const plannedAhead = todayItems.reduce((n, i) => n + Math.max(0, toMinutes(i.end) - Math.max(toMinutes(i.start), now)), 0)
  const free = freeToday === null ? null : Math.max(0, freeToday - plannedAhead)
  const rows: Row[] = [
    ...state.events.filter((e) => occursOn(e, today)).map((e) => ({ key: e.id, start: e.start, end: e.end, title: e.title, color: 'var(--text-2)', fixed: true })),
    ...(plan?.result.commuteBlocks ?? []).filter((b) => b.date === today).map((b) => ({ key: `commute-${b.start}`, start: b.start, end: b.end, title: `Transporte · ${b.modes.map((m) => TRANSPORT_LABEL[m]).join(' + ')}`, color: 'var(--amber)', fixed: true })),
    ...(plan?.result.essentialBlocks ?? []).filter((b) => b.date === today).map((b) => ({ key: `ess-${b.title}-${b.start}`, start: b.start, end: b.end, title: b.title, color: 'var(--green)', fixed: true })),
    ...todayItems.map((i) => ({ key: i.id, start: i.start, end: i.end, title: names.get(i.activityId) ?? 'Atividade', color: colorFor(i.activityId), fixed: false })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  const upcoming = (plan?.result.scheduledItems ?? []).filter((i) => i.date > today).slice(0, 4)
  const goals = [...state.goals].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3)
  const commute = state.preferences.commute
  const hour = new Date().getHours()

  const ask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void send(text)
    setText('')
    onNavigate('assistant')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite'}</h1>
          <p className="muted">{WEEKDAYS_LONG[weekdayOf(today)]}, {today}</p>
        </div>
      </div>

      <Card className="hero">
        <h2 style={{ fontSize: 22 }}>Diz o que precisas de fazer.</h2>
        <p className="muted" style={{ margin: '4px 0 14px' }}>Eu encaixo tudo no teu tempo livre — de forma realista.</p>
        <form className="composer" style={{ marginTop: 0 }} onSubmit={ask}>
          <input className="input" style={{ background: 'rgba(255,255,255,0.9)', color: '#1c1c1e' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: quero ir ao ginásio 3 vezes por semana" />
          <Button variant="plain" icon aria-label="Enviar"><Icon name="send" size={18} /></Button>
        </form>
        <div className="row" style={{ marginTop: 14 }}>
          <Button variant="plain" disabled={busy} onClick={async () => { await generate(weekStart); onNavigate('calendar') }}>
            <Icon name="sparkle" size={16} />{busy ? 'A gerar…' : plan ? 'Replanear a semana' : 'Planear a minha semana'}
          </Button>
        </div>
      </Card>

      <div className="grid three" style={{ margin: '16px 0' }}>
        <Card><div className="stat"><span className="muted small">Livre hoje</span><b style={{ color: 'var(--green)' }}>{free === null ? '—' : formatDuration(free)}</b><span className="small muted">daqui até deitares, depois de compromissos e plano</span></div></Card>
        <Card><div className="stat"><span className="muted small">Planeado hoje</span><b style={{ color: 'var(--accent)' }}>{formatDuration(plannedToday)}</b><span className="small muted">{todayItems.length} sessões</span></div></Card>
        <Card><div className="stat"><span className="muted small">Semana</span><b style={{ color: 'var(--orange)' }}>{plan ? `${plan.result.requestedMinutes ? Math.round((plan.result.scheduledMinutes / plan.result.requestedMinutes) * 100) : 100}%` : '—'}</b><span className="small muted">{plan ? 'do pedido encaixado' : 'ainda sem plano'}</span></div></Card>
      </div>

      <div className="grid two">
        <Card>
          <CardHead title="Hoje"><Button small variant="tinted" onClick={() => onNavigate('calendar')}>Ver semana</Button></CardHead>
          {rows.length === 0 && <Empty>Dia livre. Aproveita.</Empty>}
          <div className="list">
            {rows.map((r) => (
              <div key={r.key} className="list-item">
                <span className="dot" style={{ background: r.color }} />
                <div className="grow"><h3>{r.title}</h3><div className="small muted">{r.start}–{r.end} · {r.fixed ? 'Fixo' : 'Planeado'}</div></div>
              </div>
            ))}
          </div>
        </Card>
        <div>
          <Card>
            <CardHead title="A seguir" />
            {upcoming.length === 0 && <Empty>{plan ? 'Nada mais planeado.' : 'Gera um plano para ver aqui as próximas atividades.'}</Empty>}
            <div className="list">
              {upcoming.map((i) => (
                <div key={i.id} className="list-item">
                  <span className="dot" style={{ background: colorFor(i.activityId) }} />
                  <div className="grow"><h3>{names.get(i.activityId)}</h3><div className="small muted">{WEEKDAYS_LONG[weekdayOf(i.date)]} · {i.start}–{i.end}</div></div>
                </div>
              ))}
            </div>
          </Card>
          {commute && commute.minutesPerDay > 0 && (
            <Card>
              <CardHead title="Aproveitar o transporte" />
              <p className="small muted">{commute.modes.map((m) => TRANSPORT_LABEL[m]).join(' + ')} · {formatDuration(commute.minutesPerDay)} por dia</p>
              <ul className="tip-list small">{[...new Set(commute.modes.flatMap((m) => TRANSPORT_TIPS[m].slice(0, 2)))].slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul>
            </Card>
          )}
          <Card>
            <CardHead title="Objetivos" />
            {goals.length === 0 && <Empty>Sem objetivos.</Empty>}
            <div className="list">
              {goals.map((g) => (
                <div key={g.id} className="list-item">
                  <div className="grow"><h3>{g.title}</h3><div className="small muted">{g.deadline}</div></div>
                  <span className="chip orange">{Math.max(0, daysBetween(today, g.deadline))} dias</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
