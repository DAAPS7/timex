// Wall-clock helpers. Dates are 'YYYY-MM-DD', times are 'HH:mm', weekdays are Monday=0..Sunday=6.
// Everything is expressed in the user's local time, so the engine never depends on the host timezone.

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const utc = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export const addDays = (date: string, n: number): string =>
  new Date(utc(date) + n * 86_400_000).toISOString().slice(0, 10)

export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86_400_000)

export const weekdayOf = (date: string): number => (new Date(utc(date)).getUTCDay() + 6) % 7

export const startOfWeek = (date: string): string => addDays(date, -weekdayOf(date))

export const weekDates = (weekStart: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

export const todayLocal = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Minutes since local midnight. */
export const nowLocalMinutes = (): number => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const WEEKDAYS_LONG = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
