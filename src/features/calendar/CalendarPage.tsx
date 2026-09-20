import { useState } from 'react'
import { addDays, startOfWeek, todayLocal, weekDates, weekdayOf, WEEKDAYS_SHORT, WEEKDAYS_LONG } from '../../../shared/time'
import { REASON_TEXT } from '../../../shared/reasons'
import type { CalendarEvent, ScheduledItem } from '../../../shared/domain'
import { Button, Icon, Modal, Segmented } from '../../components/ui'
import { useAutoPlan } from '../../hooks/useAutoPlan'
import { usePlanning } from '../../hooks/usePlanning'
import { useStore } from '../../state/store'
import { PlanPanel } from '../planning/PlanPanel'
import { AgendaView } from './AgendaView'
import { EventForm } from './EventForm'
import { datesFor, loadView, saveView, STEP_DAYS, VIEW_OPTIONS, type CalendarView } from './views'
import { WeekGrid } from './WeekGrid'

const monthName = (d: string) => {
  const s = new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return s[0].toUpperCase() + s.slice(1)
}

export function CalendarPage() {
  const { state, dispatch } = useStore()
  const { generate, replanAffected, busy, error } = usePlanning()
  const today = todayLocal()
  const [view, setView] = useState<CalendarView>(loadView)
  const [anchor, setAnchor] = useState(today) // first day shown (day / 3 days) or any day of the week shown
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [viewing, setViewing] = useState<ScheduledItem | null>(null)

  const dates = datesFor(view, anchor)
  const weeks = [...new Set(dates.map(startOfWeek))]
  const weekStart = weeks[0] // the plan panel below follows the first week on screen
  useAutoPlan(weeks) // every week on screen gets a proposed plan when it has none
  const plan = state.plans[weekStart]
  const move = (delta: number) => setAnchor(addDays(anchor, delta * STEP_DAYS[view]))
  const chooseView = (next: CalendarView) => {
    setView(next)
    saveView(next)
  }
  const activity = viewing && state.activities.find((a) => a.id === viewing.activityId)

  // A new, edited or removed event changes the week: save it, then revise the affected plans keeping what still works.
  const saveEvents = (events: CalendarEvent[]) => {
    events.forEach((event) => dispatch({ type: 'upsertEvent', event }))
    const ids = new Set(events.map((e) => e.id))
    void replanAffected({ ...state, events: [...state.events.filter((e) => !ids.has(e.id)), ...events] })
  }
  const removeEvent = (id: string) => {
    dispatch({ type: 'deleteEvent', id })
    void replanAffected({ ...state, events: state.events.filter((e) => e.id !== id) })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendário</h1>
          <p className="muted">{monthName(dates[0])}</p>
        </div>
        <div className="row">
          <Button variant="plain" icon onClick={() => move(-1)} aria-label="Anterior"><Icon name="left" size={18} /></Button>
          <Button variant="plain" onClick={() => setAnchor(today)}>Hoje</Button>
          <Button variant="plain" icon onClick={() => move(1)} aria-label="Seguinte"><Icon name="right" size={18} /></Button>
          <Button variant="tinted" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Evento</Button>
          <Button onClick={() => generate(weekStart)} disabled={busy}><Icon name="sparkle" size={16} />{busy ? 'A gerar…' : plan ? 'Replanear' : 'Gerar plano'}</Button>
        </div>
      </div>

      {error && <div className="notice" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="view-picker"><Segmented options={VIEW_OPTIONS} value={view} onChange={chooseView} /></div>

      {(view === 'day' || view === '3days') && (
        <div className="day-tabs">
          {weekDates(startOfWeek(anchor)).map((d) => (
            <button key={d} className={dates.includes(d) ? 'on' : ''} onClick={() => setAnchor(d)}>{WEEKDAYS_SHORT[weekdayOf(d)]} {Number(d.slice(8))}</button>
          ))}
        </div>
      )}

      {view === 'agenda' ? (
        <AgendaView dates={dates} today={today} events={state.events} activities={state.activities} plans={state.plans} onEvent={setEditing} onItem={setViewing} />
      ) : (
        <WeekGrid
          dates={dates} today={today} plans={state.plans}
          dayStart={state.preferences.dayStart} dayEnd={state.preferences.dayEnd}
          events={state.events} activities={state.activities}
          onEvent={setEditing} onItem={setViewing}
        />
      )}

      <div className="legend" style={{ margin: '14px 4px 18px' }}>
        <span><i style={{ background: 'var(--text-2)' }} />Compromisso fixo</span>
        <span><i style={{ background: 'var(--accent)' }} />Atividade planeada</span>
        <span><i style={{ border: '1px dashed var(--amber)' }} />Transporte</span>
        <span><i style={{ border: '1px dashed var(--green)' }} />Refeições e essenciais</span>
        <span><i style={{ border: '1.5px solid var(--sep)' }} />Tempo livre</span>
      </div>

      {plan ? (
        <PlanPanel plan={plan} activities={state.activities} busy={busy}
          onAccept={() => dispatch({ type: 'acceptPlan', weekStart })} onRegenerate={() => generate(weekStart)}
          onNextWeek={() => setAnchor(addDays(weekStart, 7))} />
      ) : (
        <div className="card muted">Ainda não há plano para esta semana. Adiciona atividades para o motor as encaixar no tempo livre.</div>
      )}

      {editing && (
        <EventForm
          event={editing === 'new' ? undefined : editing} defaultDate={dates.includes(today) ? today : dates[0]}
          onClose={() => setEditing(null)}
          onSave={(events) => { saveEvents(events); setEditing(null) }}
          onDelete={editing === 'new' ? undefined : () => { removeEvent(editing.id); setEditing(null) }}
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
