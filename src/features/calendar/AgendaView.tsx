import { WEEKDAYS_LONG, weekdayOf } from '../../../shared/time'
import { occursOn } from '../../../shared/events'
import { Empty } from '../../components/ui'
import { colorFor } from '../../utils/colors'
import { freeLabel, planFor, transportLabel, type DayViewProps } from './WeekGrid'

interface Row { key: string; start: string; end: string; title: string; color: string; onClick?: () => void }

/** A list of each day's commitments, transport and planned sessions in time order: the easiest view on a phone. */
export function AgendaView({ dates, today, events, activities, plans, onEvent, onItem }: DayViewProps) {
  const names = new Map(activities.map((a) => [a.id, a.name]))
  return (
    <div className="agenda">
      {dates.map((date) => {
        const plan = planFor(plans, date)
        const rows: Row[] = [
          ...events.filter((e) => occursOn(e, date)).map((e) => ({ key: e.id, start: e.start, end: e.end, title: e.title, color: 'var(--text-2)', onClick: () => onEvent(e) })),
          ...(plan?.result.commuteBlocks ?? []).filter((b) => b.date === date).map((b) => ({ key: `c-${b.start}`, start: b.start, end: b.end, title: `Transporte · ${transportLabel(b.modes)}`, color: 'var(--amber)' })),
          ...(plan?.result.essentialBlocks ?? []).filter((b) => b.date === date).map((b) => ({ key: `e-${b.title}-${b.start}`, start: b.start, end: b.end, title: b.title, color: 'var(--green)' })),
          ...(plan?.result.scheduledItems ?? []).filter((i) => i.date === date).map((i) => ({ key: i.id, start: i.start, end: i.end, title: names.get(i.activityId) ?? 'Atividade', color: colorFor(i.activityId), onClick: () => onItem(i) })),
        ].sort((a, b) => a.start.localeCompare(b.start))
        const free = freeLabel(plan, date, today)
        return (
          <section key={date} className={`card agenda-day ${date < today ? 'past' : ''}`}>
            <div className="card-head">
              <h3>{WEEKDAYS_LONG[weekdayOf(date)]} {Number(date.slice(8))}{date === today ? ' · hoje' : ''}</h3>
              {free && <span className="chip green">{free}</span>}
            </div>
            {rows.length === 0 && <Empty>{date < today ? 'Sem registos.' : `Dia livre${plan ? '' : ' (ainda sem plano)'}.`}</Empty>}
            <div className="list">
              {rows.map((r) => (
                <div key={r.key} className="list-item">
                  <span className="dot" style={{ background: r.color }} />
                  {r.onClick
                    ? <button className="grow" onClick={r.onClick}><h3>{r.title}</h3><div className="small muted">{r.start}–{r.end}</div></button>
                    : <div className="grow"><h3>{r.title}</h3><div className="small muted">{r.start}–{r.end}</div></div>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
