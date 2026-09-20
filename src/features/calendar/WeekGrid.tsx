import { toMinutes, formatDuration, startOfWeek, weekdayOf, WEEKDAYS_SHORT } from '../../../shared/time'
import { occursOn } from '../../../shared/events'
import { wakingWindow } from '../../../shared/routine'
import type { Activity, CalendarEvent, Plan, ScheduledItem, TransportMode } from '../../../shared/domain'
import { TRANSPORT_LABEL } from '../../../shared/transport'
import { colorFor } from '../../utils/colors'

export interface DayViewProps {
  dates: string[]
  today: string
  events: CalendarEvent[]
  activities: Activity[]
  plans: Record<string, Plan> // by weekStart; a range of days can span two weeks
  onEvent: (e: CalendarEvent) => void
  onItem: (i: ScheduledItem) => void
}

interface Props extends DayViewProps {
  dayStart: string
  dayEnd: string
}

const top = (min: number, startMin: number) => `calc(${(min - startMin) / 60} * var(--hour))`
const height = (from: number, to: number) => `calc(${(to - from) / 60} * var(--hour) - 2px)`

export const planFor = (plans: Record<string, Plan>, date: string): Plan | undefined => plans[startOfWeek(date)]

export const transportLabel = (modes: TransportMode[]): string => modes.map((m) => TRANSPORT_LABEL[m]).join(' + ')

/** Free time left on a day, or undefined when there is nothing to say (no plan yet, or the day is over). */
export function freeLabel(plan: Plan | undefined, date: string, today: string): string | undefined {
  if (!plan || date < today) return undefined
  const { freeMinutesByDay, availableMinutesByDay } = plan.result
  const free = freeMinutesByDay?.[date] ?? availableMinutesByDay[date]
  return free === undefined ? undefined : `livre ${formatDuration(free)}`
}

/** Pure presentation: draws fixed events, planned items and (implicitly) free time for a run of days. */
export function WeekGrid({ dates, today, dayStart, dayEnd, events, activities, plans, onEvent, onItem }: Props) {
  const window = wakingWindow({ dayStart, dayEnd })
  const startHour = Math.floor(window.start / 60)
  const endHour = Math.ceil(window.end / 60)
  const startMin = startHour * 60
  const hours = endHour - startHour
  const names = new Map(activities.map((a) => [a.id, a.name]))

  return (
    <div className={`week ${dates.length > 3 ? 'dense' : ''}`} style={{ ['--hours' as string]: hours, ['--cols' as string]: dates.length }}>
      <div>
        <div className="week-head" style={{ visibility: 'hidden' }}><b>0</b><span className="free">0</span></div>
        <div className="axis">
          {Array.from({ length: hours }, (_, i) => (
            <span key={i} style={{ top: `calc(${i} * var(--hour))` }}>{i === 0 ? '' : `${String(startHour + i).padStart(2, '0')}:00`}</span>
          ))}
        </div>
      </div>
      {dates.map((date) => {
        const plan = planFor(plans, date)
        const items = plan?.result.scheduledItems.filter((i) => i.date === date) ?? []
        return (
          <div key={date}>
            <div className={`week-head ${date === today ? 'today' : ''}`}>
              <span className="small muted">{WEEKDAYS_SHORT[weekdayOf(date)]}</span>
              <b>{Number(date.slice(8))}</b>
              <span className="free">{freeLabel(plan, date, today) ?? ' '}</span>
            </div>
            <div className={`day-col ${date < today ? 'past' : ''}`}>
              {events.filter((e) => occursOn(e, date)).map((e) => (
                <button key={e.id} className={`block ${e.kind === 'travel' ? 'commute travel' : 'fixed'}`} onClick={() => onEvent(e)}
                  style={{ top: top(Math.max(toMinutes(e.start), startMin), startMin), height: height(Math.max(toMinutes(e.start), startMin), toMinutes(e.end)) }}>
                  <b>{e.title}</b>{e.start}–{e.end}
                </button>
              ))}
              {(plan?.result.commuteBlocks ?? []).filter((b) => b.date === date).map((b) => (
                <div key={`${b.start}-commute`} className="block commute" title={transportLabel(b.modes)}
                  style={{ top: top(Math.max(toMinutes(b.start), startMin), startMin), height: height(Math.max(toMinutes(b.start), startMin), toMinutes(b.end)) }}>
                  <b>{transportLabel(b.modes)}</b>{b.start}–{b.end}
                </div>
              ))}
              {(plan?.result.essentialBlocks ?? []).filter((b) => b.date === date).map((b) => (
                <div key={`${b.start}-essential`} className="block essential" title={b.title}
                  style={{ top: top(Math.max(toMinutes(b.start), startMin), startMin), height: height(Math.max(toMinutes(b.start), startMin), toMinutes(b.end)) }}>
                  <b>{b.title}</b>{b.start}–{b.end}
                </div>
              ))}
              {items.map((i) => (
                <button key={i.id} className={`block planned ${i.reasons.includes('DURING_TRAVEL') ? 'overlap' : ''}`} onClick={() => onItem(i)}
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
