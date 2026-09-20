import { useState } from 'react'
import { splitWeeklyMinutes } from '../../../shared/sessions'
import { WEEKDAYS_SHORT, formatDuration } from '../../../shared/time'
import type { Activity, CalendarEvent, Goal, Priority } from '../../../shared/domain'
import { Button, Field, Modal, Segmented } from '../../components/ui'
import { newId } from '../../utils/ids'

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }
const PRIORITIES = (Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => ({ value, label: PRIORITY_LABEL[value] }))

interface Props {
  activity?: Activity
  goals: Goal[]
  events: CalendarEvent[] // where an overlappable activity may be done: the user's events that allow other things
  onSave: (a: Activity) => void
  onDelete?: () => void
  onClose: () => void
}

export function ActivityForm({ activity, goals, events, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(activity?.name ?? '')
  const [weeklyHours, setWeeklyHours] = useState(activity ? (activity.sessionsPerWeek * activity.sessionMinutes) / 60 : 3)
  const [preferredSession, setPreferredSession] = useState(activity?.sessionMinutes ?? 60)
  const [priority, setPriority] = useState<Priority>(activity?.priority ?? 'medium')
  const [days, setDays] = useState<number[]>(activity?.preferredDays ?? [])
  const [prefStart, setPrefStart] = useState(activity?.preferredStart ?? '')
  const [prefEnd, setPrefEnd] = useState(activity?.preferredEnd ?? '')
  const [canOverlap, setCanOverlap] = useState(activity?.canOverlap ?? false)
  const [overlapWith, setOverlapWith] = useState<string[]>(activity?.overlapWith ?? [])
  const [maxOverlapHours, setMaxOverlapHours] = useState(activity?.maxOverlapMinutes ? activity.maxOverlapMinutes / 60 : 0) // 0 = no cap
  const [onlyPreferred, setOnlyPreferred] = useState(activity?.onlyPreferred ?? false)
  const [split, setSplit] = useState(activity?.splitMinutes ?? 0) // 0 = one block
  const [deadline, setDeadline] = useState(activity?.deadline ?? '')
  const [goalId, setGoalId] = useState(activity?.goalId ?? '')

  const windowOk = (prefStart === '') === (prefEnd === '') && (prefStart === '' || prefEnd > prefStart)
  // The user says how many hours per week; sessions are derived from the preferred session length.
  const { sessionsPerWeek: sessions, sessionMinutes: minutes } = splitWeeklyMinutes(weeklyHours * 60, preferredSession)
  // Titles of the user's events that allow other things, plus automatic bus/train travel.
  const overlapSources = [...new Set([...events.filter((e) => e.canOverlap).map((e) => e.title), 'Transporte'])]
  const splitOn = split > 0
  const splitOk = !splitOn || (split >= 15 && split < minutes)
  const valid = name.trim() !== '' && weeklyHours >= 0.25 && preferredSession >= 15 && windowOk && splitOk

  const save = () =>
    onSave({
      id: activity?.id ?? newId('a'),
      name: name.trim(),
      sessionsPerWeek: sessions,
      sessionMinutes: minutes,
      priority,
      preferredDays: [...days].sort(),
      preferredStart: prefStart || undefined,
      preferredEnd: prefEnd || undefined,
      splitMinutes: splitOn ? split : undefined,
      canOverlap: canOverlap || undefined,
      overlapWith: canOverlap && overlapWith.length > 0 ? overlapWith : undefined,
      maxOverlapMinutes: canOverlap && maxOverlapHours > 0 ? Math.round(maxOverlapHours * 60) : undefined,
      onlyPreferred: onlyPreferred && prefStart !== '' ? true : undefined,
      deadline: deadline || undefined,
      goalId: goalId || undefined,
    })

  return (
    <Modal title={activity ? 'Editar atividade' : 'Nova atividade'} onClose={onClose}>
      <Field label="Nome"><input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Ginásio, Estudar…" /></Field>
      <div className="two-col">
        <Field label="Horas por semana"><input className="input" type="number" min={0.25} max={40} step={0.25} value={weeklyHours} onChange={(e) => setWeeklyHours(Number(e.target.value))} /></Field>
        <Field label="Duração de cada sessão (min)"><input className="input" type="number" min={15} max={480} step={15} value={preferredSession} onChange={(e) => setPreferredSession(Number(e.target.value))} /></Field>
      </div>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>Fica em {sessions} {sessions === 1 ? 'sessão' : 'sessões'} de {formatDuration(minutes)} ({formatDuration(sessions * minutes)} por semana)</p>
      <label className="row" style={{ marginBottom: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={splitOn} onChange={(e) => setSplit(e.target.checked ? Math.min(30, Math.max(15, minutes - 15)) : 0)} />
        <span>Pode ser dividida em blocos ao longo do dia</span>
      </label>
      {splitOn && (
        <Field label="Duração de cada bloco (min)">
          <input className="input" type="number" min={15} max={240} step={15} value={split} onChange={(e) => setSplit(Number(e.target.value))} />
        </Field>
      )}
      {splitOn && !splitOk && <p className="small" style={{ color: 'var(--red)', marginTop: -6, marginBottom: 12 }}>O bloco tem de ter pelo menos 15 min e ser mais curto que a sessão ({formatDuration(minutes)}).</p>}
      {splitOn && splitOk && <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>Cada sessão vira {Math.ceil(minutes / split)} blocos de {formatDuration(split)}, espaçados no mesmo dia.</p>}
      <Field label="Prioridade"><Segmented options={PRIORITIES} value={priority} onChange={setPriority} /></Field>
      <Field label="Dias preferidos (opcional)">
        <div className="segmented">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button key={d} type="button" className={days.includes(i) ? 'on' : ''}
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
          ))}
        </div>
      </Field>
      <h3 style={{ margin: '4px 0 8px' }}>Horas preferidas</h3>
      <div className="two-col">
        <Field label="A partir das"><input className="input" type="time" value={prefStart} onChange={(e) => setPrefStart(e.target.value)} /></Field>
        <Field label="Até às"><input className="input" type="time" value={prefEnd} onChange={(e) => setPrefEnd(e.target.value)} /></Field>
      </div>
      {prefStart !== '' && (
        <label className="row" style={{ marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyPreferred} onChange={(e) => setOnlyPreferred(e.target.checked)} />
          <span>Só dentro deste horário (senão é apenas uma preferência)</span>
        </label>
      )}
      <label className="row" style={{ marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={canOverlap} onChange={(e) => setCanOverlap(e.target.checked)} />
        <span>Pode fazer-se durante viagens ou outros tempos em que dá para fazer outras coisas (ler, podcasts…)</span>
      </label>
      {canOverlap && (
        <>
          <Field label="Onde (nenhum marcado = qualquer tempo que o permita)">
            <div className="day-chips">
              {overlapSources.map((s) => (
                <button key={s} type="button" aria-pressed={overlapWith.includes(s)} className={overlapWith.includes(s) ? 'on' : ''}
                  onClick={() => setOverlapWith(overlapWith.includes(s) ? overlapWith.filter((x) => x !== s) : [...overlapWith, s])}>{s}</button>
              ))}
            </div>
          </Field>
          {overlapSources.length === 0 && <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>Ainda não tens eventos que permitam fazer outras coisas. Marca-os no calendário ("Dá para fazer outras coisas ao mesmo tempo").</p>}
          <Field label="No máximo por semana nestes tempos (horas, 0 = sem limite)">
            <input className="input" type="number" min={0} max={40} step={0.5} value={maxOverlapHours} onChange={(e) => setMaxOverlapHours(Number(e.target.value))} />
          </Field>
        </>
      )}
      {!windowOk && <p className="small" style={{ color: 'var(--red)', marginTop: -6, marginBottom: 12 }}>Indica início e fim do horário preferido (fim depois do início).</p>}
      <div className="two-col">
        <Field label="Prazo (opcional)"><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <Field label="Objetivo (opcional)">
          <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">—</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </Field>
      </div>
      <div className="modal-actions">
        {onDelete && <Button variant="danger" onClick={onDelete}>Apagar</Button>}
        <span className="spacer" />
        <Button variant="plain" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={save}>Guardar</Button>
      </div>
    </Modal>
  )
}
