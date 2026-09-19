import { credentialsSchema, type User } from '../../../shared/domain'
import type { Env } from '../../core/env'
import { authenticate, createSession, deleteSession, registerUser } from '../../domains/users/userService'
import { handle, json, parseBody, requireUser, sessionCookie, sessionToken } from '../http'

const startSession = async (request: Request, env: Env, user: User, status = 200) =>
  json({ user }, status, { 'set-cookie': sessionCookie(request, await createSession(env.DB, user.id)) })

export const register = (request: Request, env: Env): Promise<Response> =>
  handle(async () => startSession(request, env, await registerUser(env.DB, await parseBody(request, credentialsSchema)), 201))

export const login = (request: Request, env: Env): Promise<Response> =>
  handle(async () => startSession(request, env, await authenticate(env.DB, await parseBody(request, credentialsSchema))))

export const logout = (request: Request, env: Env): Promise<Response> =>
  handle(async () => {
    const token = sessionToken(request)
    if (token) await deleteSession(env.DB, token)
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, null) })
  })

export const me = (request: Request, env: Env): Promise<Response> =>
  handle(async () => json({ user: await requireUser(request, env) }))
