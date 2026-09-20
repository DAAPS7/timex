import { useState } from 'react'
import { addDays, weekdayOf, WEEKDAYS_SHORT } from '../../../shared/time'
import type { CalendarEvent } from '../../../shared/domain'
import { Button, Field, Modal, Segmented } from '../../components/ui'
import { newId } from '../../utils/ids'

interface Props {
  event?: CalendarEvent
  defaultDate: string
  /** Start with the weekly (fixed schedule) option selected, e.g. from the setup wizard. */
  defaultWeekly?: boolean
  onSave: (events: CalendarEvent[]) => void
  onDelete?: () => void
  onClose: () => void
}

const KINDS = [
  { value: 'once', label: 'Pontual' },
  { value: 'weekly', label: 'Todas as semanas' },
] as const

/** First date on or after `from` that falls on the given weekday (0 = Monday). */
const firstOnOrAfter = (from: string, weekday: number): string => addDays(from, (weekday - weekdayOf(from) + 7) % 7)

export function EventForm({ event, defaultDate, defaultWeekly, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? defaultDate)
  const [start, setStart] = useState(event?.start ?? '10:00')
  const [end, setEnd] = useState(event?.end ?? '11:00')
  const [kind, setKind] = useState<'once' | 'weekly'>(event ? (event.weekly ? 'weekly' : 'once') : defaultWeekly ? 'weekly' : 'once')
  const [remote, setRemote] = useState(event?.remote ?? false)
  const [days, setDays] = useState<number[]>([weekdayOf(event?.date ?? defaultDate)])
  const weekly = kind === 'weekly'
  const multiDay = weekly && !event // a new weekly commitment can be created for several weekdays at once
  const valid = title.trim().length > 0 && end > start && (!multiDay || days.length > 0)

  const save = () => {
    const base = { title: title.trim(), start, end, weekly, ...(remote ? { remote: true } : {}) }
    if (!multiDay) return onSave([{ ...base, id: event?.id ?? newId('ev'), date }])
    onSave(days.sort().map((d) => ({ ...base, id: newId('ev'), date: firstOnOrAfter(date, d) })))
  }

  return (
    <Modal title={event ? 'Editar evento' : 'Novo evento'} onClose={onClose}>
      <Field label="Tipo">
        <Segmented options={[...KINDS]} value={kind} onChange={setKind} />
      </Field>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>
        {weekly ? 'Horário fixo que se repete (trabalho, universidade…). O plano nunca lhe mexe.' : 'Reunião, exame ou imprevisto. Se já tens plano, ele ajusta-se.'}
      </p>
      {weekly && (
        <>
          <Field label="Onde"><Segmented options={[{ value: 'in', label: 'Presencial' }, { value: 'remote', label: 'Remoto / online' }]} value={remote ? 'remote' : 'in'} onChange={(v) => setRemote(v === 'remote')} /></Field>
          <p className="small muted" style={{ marginTop: -6, marginBottom: 14 }}>{remote ? 'Sem deslocação: não reservo tempo de transporte para este horário.' : 'Reservo o tempo de transporte antes do primeiro e depois do último horário presencial do dia.'}</p>
        </>
      )}
      <Field label="Título"><input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder={weekly ? 'Universidade, trabalho…' : 'Reunião, exame, consulta…'} /></Field>
      <Field label={multiDay ? 'A partir de' : 'Data'}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      {multiDay && (
        <Field label="Dias da semana">
          <div className="day-chips">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={d} type="button" className={days.includes(i) ? 'on' : ''}
                onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
            ))}
          </div>
        </Field>
      )}
      <div className="two-col">
        <Field label="Início"><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Fim"><input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      {end <= start && <p className="small" style={{ color: 'var(--red)' }}>O fim tem de ser depois do início.</p>}
      <div className="modal-actions">
        {onDelete && <Button variant="danger" onClick={onDelete}>Apagar</Button>}
        <span className="spacer" />
        <Button variant="plain" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={save}>Guardar</Button>
      </div>
    </Modal>
  )
}
