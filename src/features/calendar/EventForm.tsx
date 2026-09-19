import { useState } from 'react'
import type { CalendarEvent } from '../../../shared/domain'
import { Button, Field, Modal } from '../../components/ui'
import { newId } from '../../utils/ids'

interface Props {
  event?: CalendarEvent
  defaultDate: string
  onSave: (e: CalendarEvent) => void
  onDelete?: () => void
  onClose: () => void
}

export function EventForm({ event, defaultDate, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? defaultDate)
  const [start, setStart] = useState(event?.start ?? '10:00')
  const [end, setEnd] = useState(event?.end ?? '11:00')
  const [weekly, setWeekly] = useState(event?.weekly ?? false)
  const valid = title.trim().length > 0 && end > start

  return (
    <Modal title={event ? 'Evento fixo' : 'Novo evento fixo'} onClose={onClose}>
      <Field label="Título"><input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="Aula, turno, consulta…" /></Field>
      <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="two-col">
        <Field label="Início"><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Fim"><input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <label className="row" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Repete todas as semanas
      </label>
      {end <= start && <p className="small" style={{ color: 'var(--red)' }}>O fim tem de ser depois do início.</p>}
      <div className="modal-actions">
        {onDelete && <Button variant="danger" onClick={onDelete}>Apagar</Button>}
        <span className="spacer" />
        <Button variant="plain" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={() => onSave({ id: event?.id ?? newId('ev'), title: title.trim(), date, start, end, weekly })}>Guardar</Button>
      </div>
    </Modal>
  )
}
