import { useState } from 'react'
import { formatDuration, startOfWeek, todayLocal, weekdayOf, WEEKDAYS_LONG } from '../../../shared/time'
import type { Activity, CalendarEvent, Preferences } from '../../../shared/domain'
import { Button, Card, CardHead, Empty, Icon } from '../../components/ui'
import { usePlanning } from '../../hooks/usePlanning'
import { useStore } from '../../state/store'
import { ActivityForm } from '../activities/ActivityForm'
import { EventForm } from '../calendar/EventForm'
import { CommuteFields, EssentialsFields, SleepFields } from '../settings/RoutineFields'

const STEPS = ['Horários fixos', 'Sono e refeições', 'Transporte', 'Atividades', 'Pronto'] as const

/** Guided first-run setup: fixed schedule, sleep, transport, then the activities the user wants to fit in. */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useStore()
  const { generate, busy } = usePlanning()
  const [step, setStep] = useState(0)
  const [eventForm, setEventForm] = useState<CalendarEvent | 'new' | null>(null)
  const [activityForm, setActivityForm] = useState<Activity | 'new' | null>(null)
  const p = state.preferences
  const setPrefs = (patch: Partial<Preferences>) => dispatch({ type: 'setPreferences', preferences: { ...p, ...patch } })

  const fixed = state.events
    .filter((e) => e.weekly)
    .sort((a, b) => weekdayOf(a.date) - weekdayOf(b.date) || a.start.localeCompare(b.start))
  const weeklyMinutes = state.activities.reduce((n, a) => n + a.sessionsPerWeek * a.sessionMinutes, 0)

  const finish = async (skipPlan = false) => {
    setPrefs({ setupDone: true })
    onDone()
    if (!skipPlan && state.activities.length > 0) await generate(startOfWeek(todayLocal()), { ...state, preferences: { ...p, setupDone: true } })
  }

  return (
    <div className="setup">
      <div className="brand" style={{ padding: '0 0 16px' }}><span className="brand-mark"><Icon name="clock" size={20} /></span>Timex</div>
      <div className="steps" aria-hidden>{STEPS.map((s, i) => <i key={s} className={i <= step ? 'done' : ''} />)}</div>
      <p className="small muted">Passo {step + 1} de {STEPS.length}</p>
      <h1 style={{ marginBottom: 16 }}>{STEPS[step]}</h1>

      {step === 0 && (
        <Card>
          <p className="muted" style={{ marginBottom: 14 }}>
            O que não pode mexer: trabalho, universidade, aulas, compromissos que se repetem todas as semanas. O plano nunca lhes toca.
          </p>
          {fixed.length === 0 && <Empty>Ainda sem horários fixos.</Empty>}
          <div className="list">
            {fixed.map((e) => (
              <div key={e.id} className="list-item">
                <span className="dot" style={{ background: 'var(--text-2)' }} />
                <button className="grow" onClick={() => setEventForm(e)}><h3>{e.title}</h3><div className="small muted">{WEEKDAYS_LONG[weekdayOf(e.date)]} · {e.start}–{e.end}{e.remote ? ' · remoto' : ''}</div></button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}><Button variant="tinted" onClick={() => setEventForm('new')}><Icon name="plus" size={16} />Adicionar horário fixo</Button></div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <p className="muted" style={{ marginBottom: 14 }}>O sono é sagrado: o plano nunca marca nada fora das tuas horas acordado.</p>
          <SleepFields prefs={p} onChange={setPrefs} />
          <h3 style={{ margin: '18px 0 6px' }}>Refeições e essenciais</h3>
          <EssentialsFields prefs={p} onChange={setPrefs} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <p className="muted" style={{ marginBottom: 14 }}>Diz-me quanto tempo perdes em deslocações e como viajas. Reservo esse tempo e digo-te como o aproveitar.</p>
          <CommuteFields prefs={p} onChange={setPrefs} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <p className="muted" style={{ marginBottom: 14 }}>O que queres fazer e quantas horas por semana queres dedicar. Eu encaixo tudo no tempo livre.</p>
          {state.activities.length === 0 && <Empty>Ainda sem atividades.</Empty>}
          <div className="list">
            {state.activities.map((a) => (
              <div key={a.id} className="list-item">
                <button className="grow" onClick={() => setActivityForm(a)}>
                  <h3>{a.name}</h3><div className="small muted">{formatDuration(a.sessionsPerWeek * a.sessionMinutes)} por semana · {a.sessionsPerWeek}× {formatDuration(a.sessionMinutes)}</div>
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}><Button variant="tinted" onClick={() => setActivityForm('new')}><Icon name="plus" size={16} />Adicionar atividade</Button></div>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHead title="Resumo" />
          <ul className="tip-list">
            <li>{fixed.length} {fixed.length === 1 ? 'horário fixo' : 'horários fixos'}</li>
            <li>Acordas às {p.dayStart} e deitas-te às {p.dayEnd}</li>
            <li>{p.commute && p.commute.minutesPerDay > 0 ? `Transporte: ${formatDuration(p.commute.minutesPerDay)} por dia` : 'Sem transporte'}</li>
            <li>{state.activities.length} {state.activities.length === 1 ? 'atividade' : 'atividades'}, {formatDuration(weeklyMinutes)} por semana</li>
          </ul>
          <p className="muted" style={{ marginTop: 14 }}>
            Cada semana é planeada automaticamente. Quando surgir uma reunião, um exame ou um imprevisto, junta o evento e o plano ajusta-se, mexendo só no necessário.
          </p>
        </Card>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        {step > 0 && <Button variant="plain" onClick={() => setStep(step - 1)}>Voltar</Button>}
        <span className="spacer" />
        {step < STEPS.length - 1
          ? <Button onClick={() => setStep(step + 1)}>Seguinte</Button>
          : <Button disabled={busy} onClick={() => void finish()}>{state.activities.length > 0 ? 'Planear a minha semana' : 'Concluir'}</Button>}
      </div>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
        <button className="link" onClick={() => void finish(true)}>Saltar configuração</button>
      </p>

      {eventForm && (
        <EventForm
          event={eventForm === 'new' ? undefined : eventForm} defaultDate={todayLocal()} defaultWeekly
          onClose={() => setEventForm(null)}
          onSave={(events) => { events.forEach((event) => dispatch({ type: 'upsertEvent', event })); setEventForm(null) }}
          onDelete={eventForm === 'new' ? undefined : () => { dispatch({ type: 'deleteEvent', id: eventForm.id }); setEventForm(null) }}
        />
      )}
      {activityForm && (
        <ActivityForm
          activity={activityForm === 'new' ? undefined : activityForm} goals={state.goals} events={state.events}
          onClose={() => setActivityForm(null)}
          onSave={(activity) => { dispatch({ type: 'upsertActivity', activity }); setActivityForm(null) }}
          onDelete={activityForm === 'new' ? undefined : () => { dispatch({ type: 'deleteActivity', id: activityForm.id }); setActivityForm(null) }}
        />
      )}
    </div>
  )
}
