import { toMinutes, formatDuration, weekDates, WEEKDAYS_SHORT } from '../../../shared/time'
import { occursOn } from '../../../shared/events'
import type { Activity, CalendarEvent, Plan, ScheduledItem } from '../../../shared/domain'
import { colorFor } from '../../utils/colors'

interface Props {
  weekStart: string
  today: string
  selectedDay: string
  dayStart: string
  dayEnd: string
  events: CalendarEvent[]
  activities: Activity[]
  plan?: Plan
  onEvent: (e: CalendarEvent) => void
  onItem: (i: ScheduledItem) => void
}

const top = (min: number, startMin: number) => `calc(${(min - startMin) / 60} * var(--hour))`
const height = (from: number, to: number) => `calc(${(to - from) / 60} * var(--hour) - 2px)`

/** Pure presentation: draws fixed events, planned items and (implicitly) free time for one week. */
export function WeekGrid({ weekStart, today, selectedDay, dayStart, dayEnd, events, activities, plan, onEvent, onItem }: Props) {
  const startHour = Math.floor(toMinutes(dayStart) / 60)
  const endHour = Math.ceil(toMinutes(dayEnd) / 60)
  const startMin = startHour * 60
  const hours = endHour - startHour
  const names = new Map(activities.map((a) => [a.id, a.name]))

  return (
    <div className="week" style={{ ['--hours' as string]: hours }}>
      <div>
        <div className="week-head" style={{ visibility: 'hidden' }}><b>0</b><span className="free">0</span></div>
        <div className="axis">
          {Array.from({ length: hours }, (_, i) => (
            <span key={i} style={{ top: `calc(${i} * var(--hour))` }}>{i === 0 ? '' : `${String(startHour + i).padStart(2, '0')}:00`}</span>
          ))}
        </div>
      </div>
      {weekDates(weekStart).map((date, idx) => {
        const items = plan?.result.scheduledItems.filter((i) => i.date === date) ?? []
        const planned = items.reduce((n, i) => n + toMinutes(i.end) - toMinutes(i.start), 0)
        const available = plan?.result.availableMinutesByDay[date]
        return (
          <div key={date} className={date === selectedDay ? '' : 'col-hidden'}>
            <div className={`week-head ${date === today ? 'today' : ''}`}>
              <span className="small muted">{WEEKDAYS_SHORT[idx]}</span>
              <b>{Number(date.slice(8))}</b>
              <span className="free">{available === undefined ? ' ' : `livre ${formatDuration(Math.max(0, available - planned))}`}</span>
            </div>
            <div className={`day-col ${date < today ? 'past' : ''}`}>
              {events.filter((e) => occursOn(e, date)).map((e) => (
                <button key={e.id} className="block fixed" onClick={() => onEvent(e)}
                  style={{ top: top(Math.max(toMinutes(e.start), startMin), startMin), height: height(Math.max(toMinutes(e.start), startMin), toMinutes(e.end)) }}>
                  <b>{e.title}</b>{e.start}–{e.end}
                </button>
              ))}
              {items.map((i) => (
                <button key={i.id} className="block planned" onClick={() => onItem(i)}
                  style={{ top: top(toMinutes(i.start), startMin), height: height(toMinutes(i.start), toMinutes(i.end)), background: colorFor(i.activityId) }}>
                  <b>{names.get(i.activityId) ?? 'Atividade'}</b>{i.start}–{i.end}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
