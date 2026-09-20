import { sleepMinutes } from '../../../shared/routine'
import { formatDuration } from '../../../shared/time'
import { TRANSPORT_LABEL, TRANSPORT_TIPS } from '../../../shared/transport'
import type { Essential, Preferences, TransportMode } from '../../../shared/domain'
import { Button, Field, Icon } from '../../components/ui'
import { newId } from '../../utils/ids'

interface Props {
  prefs: Preferences
  onChange: (patch: Partial<Preferences>) => void
}

/** Sleep schedule: wake-up and bedtime. Everything outside that window is sleep and is never planned. */
export function SleepFields({ prefs, onChange }: Props) {
  const minutes = sleepMinutes(prefs)
  return (
    <>
      <div className="two-col">
        <Field label="Acordo às"><input className="input" type="time" value={prefs.dayStart} onChange={(e) => onChange({ dayStart: e.target.value })} /></Field>
        <Field label="Deito-me às"><input className="input" type="time" value={prefs.dayEnd} onChange={(e) => onChange({ dayEnd: e.target.value })} /></Field>
      </div>
      <p className="small muted">
        Dormes {formatDuration(minutes)} por noite. Podes pôr uma hora depois da meia-noite (ex.: 00:30).
      </p>
      {minutes < 360 && <p className="small" style={{ color: 'var(--red)', marginTop: 6 }}>Menos de 6 horas de sono não é um plano realista. O plano preserva o sono que indicares.</p>}
    </>
  )
}

const MODES = (Object.keys(TRANSPORT_LABEL) as TransportMode[]).map((value) => ({ value, label: TRANSPORT_LABEL[value] }))

/** Daily time lost in transport and how: the engine reserves it, and the tips show how to make use of it. */
export function CommuteFields({ prefs, onChange }: Props) {
  const commute = prefs.commute ?? { modes: ['bus'] as TransportMode[], minutesPerDay: 0 }
  const set = (patch: Partial<typeof commute>) => onChange({ commute: { ...commute, ...patch } })
  // Any combination of modes (e.g. walking to the station, then the train); at least one stays selected.
  const toggle = (mode: TransportMode) => {
    const on = commute.modes.includes(mode)
    if (on && commute.modes.length === 1) return
    set({ modes: MODES.map((m) => m.value).filter((m) => (m === mode ? !on : commute.modes.includes(m))) })
  }
  const labels = commute.modes.map((m) => TRANSPORT_LABEL[m].toLowerCase()).join(' + ')
  const tips = [...new Set(commute.modes.flatMap((m) => TRANSPORT_TIPS[m]))]
  return (
    <>
      <Field label="Como te deslocas (podes escolher vários)">
        <div className="day-chips">
          {MODES.map((m) => (
            <button key={m.value} type="button" aria-pressed={commute.modes.includes(m.value)} className={commute.modes.includes(m.value) ? 'on' : ''} onClick={() => toggle(m.value)}>{m.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Tempo perdido por dia, ida e volta (min)">
        <input className="input" type="number" min={0} max={300} step={5} value={commute.minutesPerDay}
          onChange={(e) => set({ minutesPerDay: Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0))) })} />
      </Field>
      <p className="small muted">Só conta nos dias com horários fixos (trabalho, universidade…). Fica reservado antes do primeiro compromisso e depois do último. 0 = sem transporte.</p>
      {commute.minutesPerDay > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>Como aproveitar {formatDuration(commute.minutesPerDay)} de {labels}:</b>
          <ul className="tip-list small">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </>
  )
}

/** Daily essentials (meals, medication…): reserved on top of free time and never planned over. */
export function EssentialsFields({ prefs, onChange }: Props) {
  const list = prefs.essentials ?? []
  const set = (essentials: Essential[]) => onChange({ essentials })
  const patch = (id: string, change: Partial<Essential>) => set(list.map((e) => (e.id === id ? { ...e, ...change } : e)))
  const add = (kind: Essential['kind']) =>
    set([...list, { id: newId('ess'), title: kind === 'meal' ? 'Refeição' : 'Essencial', start: '16:00', end: '16:30', kind }])
  return (
    <>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Tudo o que não está ocupado é tempo livre. Por cima dele reservo estas coisas todos os dias, e o plano nunca lhes toca.
      </p>
      {list.map((e) => (
        <div key={e.id} className="essential-row">
          <input className="input" value={e.title} maxLength={60} aria-label="Nome" onChange={(ev) => patch(e.id, { title: ev.target.value })} />
          <input className="input" type="time" value={e.start} aria-label="Início" onChange={(ev) => patch(e.id, { start: ev.target.value })} />
          <input className="input" type="time" value={e.end} aria-label="Fim" onChange={(ev) => patch(e.id, { end: ev.target.value })} />
          <Button variant="danger" icon aria-label={`Remover ${e.title}`} onClick={() => set(list.filter((x) => x.id !== e.id))}><Icon name="trash" size={16} /></Button>
          {e.end <= e.start && <span className="small" style={{ color: 'var(--red)', gridColumn: '1 / -1' }}>O fim tem de ser depois do início.</span>}
        </div>
      ))}
      {list.length < 12 && (
        <div className="row">
          <Button small variant="tinted" onClick={() => add('meal')}><Icon name="plus" size={14} />Refeição</Button>
          <Button small variant="tinted" onClick={() => add('other')}><Icon name="plus" size={14} />Outro essencial</Button>
        </div>
      )}
    </>
  )
}
