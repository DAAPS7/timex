// Bindings the backend needs from its host (Cloudflare Worker / Pages). `Db` is the small subset of the
// D1 API we use, so backend code does not depend on Cloudflare types.
export interface DbStatement {
  bind(...values: unknown[]): DbStatement
  first<T = unknown>(): Promise<T | null>
  run(): Promise<unknown>
}

export interface Db {
  prepare(sql: string): DbStatement
}

export interface Env {
  DB: Db
  GEMINI_API_KEY?: string // secret: `wrangler secret put GEMINI_API_KEY` (prod) or .dev.vars (local)
  GEMINI_MODEL?: string
}
