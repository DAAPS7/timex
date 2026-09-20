import { addDays } from '../../../shared/time'

export type CalendarView = 'day' | '3days' | 'week' | 'agenda'

export const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: '3days', label: '3 dias' },
  { value: 'week', label: 'Semana' },
  { value: 'agenda', label: 'Agenda' },
]

/**
 * Days shown for a view. The window rolls with the anchor (today by default) and the anchor is always the second day,
 * so yesterday and the days ahead are visible. It is not tied to Monday-Sunday: from a Sunday the week ahead is on screen.
 */
export const datesFor = (view: CalendarView, anchor: string): string[] => {
  if (view === 'day') return [anchor]
  const count = view === '3days' ? 3 : 7
  return Array.from({ length: count }, (_, i) => addDays(anchor, i - 1))
}

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
