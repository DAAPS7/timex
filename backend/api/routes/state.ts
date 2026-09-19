import { userDataSchema } from '../../../shared/domain'
import type { Env } from '../../core/env'
import { loadUserData, saveUserData } from '../../domains/users/userService'
import { handle, json, parseBody, requireUser } from '../http'

// data: null means "new user, nothing stored yet": the client decides what to start from.
export const getState = (request: Request, env: Env): Promise<Response> =>
  handle(async () => json({ data: await loadUserData(env.DB, (await requireUser(request, env)).id) }))

export const putState = (request: Request, env: Env): Promise<Response> =>
  handle(async () => {
    const user = await requireUser(request, env)
    await saveUserData(env.DB, user.id, await parseBody(request, userDataSchema))
    return json({ ok: true })
  })
