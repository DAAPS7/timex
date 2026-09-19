import { useState } from 'react'
import { WEEKDAYS_SHORT, formatDuration } from '../../../shared/time'
import type { Activity, Goal, Priority } from '../../../shared/domain'
import { Button, Field, Modal, Segmented } from '../../components/ui'
import { newId } from '../../utils/ids'

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }
const PRIORITIES = (Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => ({ value, label: PRIORITY_LABEL[value] }))

interface Props {
  activity?: Activity
  goals: Goal[]
  onSave: (a: Activity) => void
  onDelete?: () => void
  onClose: () => void
}

export function ActivityForm({ activity, goals, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(activity?.name ?? '')
  const [sessions, setSessions] = useState(activity?.sessionsPerWeek ?? 3)
  const [minutes, setMinutes] = useState(activity?.sessionMinutes ?? 60)
  const [priority, setPriority] = useState<Priority>(activity?.priority ?? 'medium')
  const [days, setDays] = useState<number[]>(activity?.preferredDays ?? [])
  const [prefStart, setPrefStart] = useState(activity?.preferredStart ?? '')
  const [prefEnd, setPrefEnd] = useState(activity?.preferredEnd ?? '')
  const [deadline, setDeadline] = useState(activity?.deadline ?? '')
  const [goalId, setGoalId] = useState(activity?.goalId ?? '')

  const windowOk = (prefStart === '') === (prefEnd === '') && (prefStart === '' || prefEnd > prefStart)
  const valid = name.trim() !== '' && sessions >= 1 && minutes >= 15 && windowOk

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
      deadline: deadline || undefined,
      goalId: goalId || undefined,
    })

  return (
    <Modal title={activity ? 'Editar atividade' : 'Nova atividade'} onClose={onClose}>
      <Field label="Nome"><input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Ginásio, Estudar…" /></Field>
      <div className="two-col">
        <Field label="Sessões por semana"><input className="input" type="number" min={1} max={14} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} /></Field>
        <Field label="Minutos por sessão"><input className="input" type="number" min={15} max={480} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></Field>
      </div>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>Total pedido: {formatDuration(sessions * minutes)} por semana</p>
      <Field label="Prioridade"><Segmented options={PRIORITIES} value={priority} onChange={setPriority} /></Field>
      <Field label="Dias preferidos (opcional)">
        <div className="segmented">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button key={d} type="button" className={days.includes(i) ? 'on' : ''}
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
          ))}
        </div>
      </Field>
      <div className="two-col">
        <Field label="Preferir a partir das"><input className="input" type="time" value={prefStart} onChange={(e) => setPrefStart(e.target.value)} /></Field>
        <Field label="…até às"><input className="input" type="time" value={prefEnd} onChange={(e) => setPrefEnd(e.target.value)} /></Field>
      </div>
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
