import { useState } from 'react'
import { addDays, startOfWeek, todayLocal, weekDates, weekdayOf, WEEKDAYS_SHORT, WEEKDAYS_LONG } from '../../../shared/time'
import { REASON_TEXT } from '../../../shared/reasons'
import type { CalendarEvent, ScheduledItem } from '../../../shared/domain'
import { Button, Icon, Modal } from '../../components/ui'
import { usePlanning } from '../../hooks/usePlanning'
import { useStore } from '../../state/store'
import { PlanPanel } from '../planning/PlanPanel'
import { EventForm } from './EventForm'
import { WeekGrid } from './WeekGrid'

const monthName = (d: string) => {
  const s = new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return s[0].toUpperCase() + s.slice(1)
}

export function CalendarPage() {
  const { state, dispatch } = useStore()
  const { generate, busy, error } = usePlanning()
  const today = todayLocal()
  const [weekStart, setWeekStart] = useState(startOfWeek(today))
  const [selectedDay, setSelectedDay] = useState(weekDates(weekStart).includes(today) ? today : weekStart)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [viewing, setViewing] = useState<ScheduledItem | null>(null)

  const plan = state.plans[weekStart]
  const goToWeek = (delta: number) => {
    const next = addDays(weekStart, delta * 7)
    setWeekStart(next)
    setSelectedDay(weekDates(next).includes(today) ? today : next)
  }
  const activity = viewing && state.activities.find((a) => a.id === viewing.activityId)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendário</h1>
          <p className="muted">{monthName(weekStart)}</p>
        </div>
        <div className="row">
          <Button variant="plain" icon onClick={() => goToWeek(-1)} aria-label="Semana anterior"><Icon name="left" size={18} /></Button>
          <Button variant="plain" onClick={() => { setWeekStart(startOfWeek(today)); setSelectedDay(today) }}>Hoje</Button>
          <Button variant="plain" icon onClick={() => goToWeek(1)} aria-label="Semana seguinte"><Icon name="right" size={18} /></Button>
          <Button variant="tinted" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Evento</Button>
          <Button onClick={() => generate(weekStart)} disabled={busy}><Icon name="sparkle" size={16} />{busy ? 'A gerar…' : plan ? 'Replanear' : 'Gerar plano'}</Button>
        </div>
      </div>

      {error && <div className="notice" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="day-tabs">
        {weekDates(weekStart).map((d) => (
          <button key={d} className={d === selectedDay ? 'on' : ''} onClick={() => setSelectedDay(d)}>{WEEKDAYS_SHORT[weekdayOf(d)]} {Number(d.slice(8))}</button>
        ))}
      </div>

      <WeekGrid
        weekStart={weekStart} today={today} selectedDay={selectedDay}
        dayStart={state.preferences.dayStart} dayEnd={state.preferences.dayEnd}
        events={state.events} activities={state.activities} plan={plan}
        onEvent={setEditing} onItem={setViewing}
      />

      <div className="legend" style={{ margin: '14px 4px 18px' }}>
        <span><i style={{ background: 'var(--text-2)' }} />Compromisso fixo</span>
        <span><i style={{ background: 'var(--accent)' }} />Atividade planeada</span>
        <span><i style={{ border: '1.5px solid var(--sep)' }} />Tempo livre</span>
      </div>

      {plan ? (
        <PlanPanel plan={plan} activities={state.activities} busy={busy}
          onAccept={() => dispatch({ type: 'acceptPlan', weekStart })} onRegenerate={() => generate(weekStart)} />
      ) : (
        <div className="card muted">Ainda não há plano para esta semana. Carrega em <b>Gerar plano</b> para o motor encaixar as tuas atividades no tempo livre.</div>
      )}

      {editing && (
        <EventForm
          event={editing === 'new' ? undefined : editing} defaultDate={selectedDay}
          onClose={() => setEditing(null)}
          onSave={(event) => { dispatch({ type: 'upsertEvent', event }); setEditing(null) }}
          onDelete={editing === 'new' ? undefined : () => { dispatch({ type: 'deleteEvent', id: editing.id }); setEditing(null) }}
        />
      )}

      {viewing && (
        <Modal title={activity?.name ?? 'Atividade'} onClose={() => setViewing(null)}>
          <p className="muted" style={{ marginBottom: 12 }}>{WEEKDAYS_LONG[weekdayOf(viewing.date)]}, {viewing.date} · {viewing.start}–{viewing.end}</p>
          <h3 style={{ marginBottom: 6 }}>Porque está aqui</h3>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            {viewing.reasons.length === 0 && <li>Foi o melhor intervalo livre disponível.</li>}
            {viewing.reasons.map((r) => <li key={r}>{REASON_TEXT[r]}</li>)}
          </ul>
          <div className="modal-actions">
            <Button variant="danger" onClick={() => { dispatch({ type: 'removeScheduledItem', weekStart, itemId: viewing.id }); setViewing(null) }}>Remover do plano</Button>
            <Button variant="plain" onClick={() => setViewing(null)}>Fechar</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
