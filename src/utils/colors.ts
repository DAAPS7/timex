const PALETTE = ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--pink)', 'var(--purple)', 'var(--teal)', 'var(--indigo)']

/** Stable vivid color per activity id. */
export function colorFor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
