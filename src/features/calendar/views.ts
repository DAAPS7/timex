import { addDays, startOfWeek, weekDates } from '../../../shared/time'

export type CalendarView = 'day' | '3days' | 'week' | 'agenda'

export const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: '3days', label: '3 dias' },
  { value: 'week', label: 'Semana' },
  { value: 'agenda', label: 'Agenda' },
]

/** Days shown for a view around `anchor`. Week and agenda always show the whole (Monday-first) week. */
export const datesFor = (view: CalendarView, anchor: string): string[] =>
  view === 'day' ? [anchor] : view === '3days' ? [0, 1, 2].map((n) => addDays(anchor, n)) : weekDates(startOfWeek(anchor))

/** How many days "previous" / "next" move the anchor. */
export const STEP_DAYS: Record<CalendarView, number> = { day: 1, '3days': 3, week: 7, agenda: 7 }

const KEY = 'timex.calendarView'

const isView = (v: unknown): v is CalendarView => VIEW_OPTIONS.some((o) => o.value === v)

/** Last chosen view; a day on small screens and the week on large ones by default. */
export function loadView(): CalendarView {
  try {
    const saved = localStorage.getItem(KEY)
    if (isView(saved)) return saved
  } catch { /* storage can be unavailable (private mode) */ }
  return window.matchMedia('(max-width: 820px)').matches ? 'day' : 'week'
}

export function saveView(view: CalendarView) {
  try { localStorage.setItem(KEY, view) } catch { /* ignore */ }
}
