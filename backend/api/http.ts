import type { ZodType } from 'zod'
import { AppError } from '../core/errors'

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

/** Parse and validate a JSON body; anything that does not match the schema is rejected. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new AppError('INVALID_REQUEST', 'Body must be valid JSON')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new AppError('INVALID_REQUEST', 'Request validation failed', parsed.error.issues)
  return parsed.data
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return json({ error: { code: e.code, message: e.message, details: e.details } }, e.status)
    console.error(e)
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } }, 500)
  }
}
