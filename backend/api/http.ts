import type { ZodType } from 'zod'
import type { User } from '../../shared/domain'
import type { Env } from '../core/env'
import { AppError } from '../core/errors'
import { SESSION_DAYS, userFromSession } from '../domains/users/userService'

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })

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

// ---- Session cookie ----

const COOKIE = 'timex_session'

export function sessionToken(request: Request): string | undefined {
  return request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]+)`))?.[1]
}

/** `Secure` is only set over https so the cookie also works on http://localhost during development. */
export function sessionCookie(request: Request, token: string | null): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  const maxAge = token ? SESSION_DAYS * 86_400 : 0
  return `${COOKIE}=${token ?? ''}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}

/** The authenticated user, taken only from the session cookie, never from client-supplied ids. */
export async function requireUser(request: Request, env: Env): Promise<User> {
  const token = sessionToken(request)
  const user = token ? await userFromSession(env.DB, token) : null
  if (!user) throw new AppError('UNAUTHORIZED', 'Inicia sessão para continuar.')
  return user
}
