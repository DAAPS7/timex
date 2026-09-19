import type { CalendarEvent } from './domain'
import { weekdayOf } from './time'

/** Whether a (possibly weekly-recurring) event takes place on the given date. Shared by the engine and the calendar view. */
export const occursOn = (event: CalendarEvent, date: string): boolean =>
  event.date === date || (event.weekly && date > event.date && weekdayOf(date) === weekdayOf(event.date))
