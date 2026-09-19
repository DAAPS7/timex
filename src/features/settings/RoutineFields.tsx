import { sleepMinutes } from '../../../shared/routine'
import { formatDuration } from '../../../shared/time'
import { TRANSPORT_LABEL, TRANSPORT_TIPS } from '../../../shared/transport'
import type { Preferences, TransportMode } from '../../../shared/domain'
import { Field, Segmented } from '../../components/ui'

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
  const commute = prefs.commute ?? { mode: 'bus' as TransportMode, minutesPerDay: 0 }
  const set = (patch: Partial<typeof commute>) => onChange({ commute: { ...commute, ...patch } })
  return (
    <>
      <Field label="Como te deslocas"><Segmented options={MODES} value={commute.mode} onChange={(mode) => set({ mode })} /></Field>
      <Field label="Tempo perdido por dia, ida e volta (min)">
        <input className="input" type="number" min={0} max={300} step={5} value={commute.minutesPerDay}
          onChange={(e) => set({ minutesPerDay: Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0))) })} />
      </Field>
      <p className="small muted">Só conta nos dias com horários fixos (trabalho, universidade…). Fica reservado antes do primeiro compromisso e depois do último. 0 = sem transporte.</p>
      {commute.minutesPerDay > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>Como aproveitar {formatDuration(commute.minutesPerDay)} de {TRANSPORT_LABEL[commute.mode].toLowerCase()}:</b>
          <ul className="tip-list small">{TRANSPORT_TIPS[commute.mode].map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </>
  )
}
