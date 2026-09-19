const PALETTE = ['var(--accent)', 'var(--accent-2)', 'var(--orange)', 'var(--crimson)', 'var(--rose)', 'var(--amber)']

/** Stable red/orange-family color per activity id. */
export function colorFor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
