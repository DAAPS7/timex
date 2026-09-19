/**
 * Turn "X hours per week" into a number of sessions and a session length (multiple of 15 min) so that
 * sessions × length is as close as possible to the requested total, never above the preferred length by much.
 */
export function splitWeeklyMinutes(totalMinutes: number, preferredSession = 90): { sessionsPerWeek: number; sessionMinutes: number } {
  const total = Math.max(15, Math.round(totalMinutes / 15) * 15)
  const sessionsPerWeek = Math.min(14, Math.max(1, Math.round(total / Math.max(15, preferredSession))))
  const sessionMinutes = Math.min(480, Math.max(15, Math.round(total / sessionsPerWeek / 15) * 15))
  return { sessionsPerWeek, sessionMinutes }
}
