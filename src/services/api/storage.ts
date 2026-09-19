// PROTOTYPE persistence: user data lives in this browser only (see docs/decisions/002-prototype-persistence.md).
// It stands in for the future /api/activities, /api/goals, ... resources backed by PostgreSQL.
import type { AppState } from '../../state/store'

const KEY = 'timex.v1'

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppState) : null
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode / quota): the app keeps working for this session
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
