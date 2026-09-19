// Legacy prototype storage (ADR 002): before accounts existed, data lived in this browser. It is only read
// once, to import that data into a new account; user data is otherwise stored on the server (ADR 003).
const KEY = 'timex.v1'

export function loadLegacyState(): unknown {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearLegacyState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
