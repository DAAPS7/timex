import { assistantRequestSchema, planningInputSchema } from '../../../shared/domain'
import { handleAssistantMessage } from '../../ai/assistantService'
import type { Env } from '../../core/env'
import { generatePlan } from '../../domains/planning/engine'
import { handle, json, parseBody, requireUser } from '../http'
import { login, logout, me, register } from './auth'
import { getState, putState } from './state'

// Route handlers are plain (Request, Env) => Response so they can be mounted by the Worker entry
// (worker/index.ts) and by the Cloudflare Pages catch-all (functions/api/[[path]].ts) without duplication.

export const health = (): Response => json({ ok: true })

// The client sends its current data, the engine returns a proposed plan. Requires a signed-in user.
export const generatePlanRoute = (request: Request, env: Env): Promise<Response> =>
  handle(async () => {
    await requireUser(request, env)
    return json(generatePlan(await parseBody(request, planningInputSchema)))
  })

export const assistantMessageRoute = (request: Request, env: Env): Promise<Response> =>
  handle(async () => {
    await requireUser(request, env)
    return json(await handleAssistantMessage(await parseBody(request, assistantRequestSchema), env))
  })

const ROUTES: Record<string, (request: Request, env: Env) => Response | Promise<Response>> = {
  'GET /api/health': health,
  'POST /api/auth/register': register,
  'POST /api/auth/login': login,
  'POST /api/auth/logout': logout,
  'GET /api/auth/me': me,
  'GET /api/state': getState,
  'PUT /api/state': putState,
  'POST /api/plans/generate': generatePlanRoute,
  'POST /api/assistant/message': assistantMessageRoute,
}

export function routeApi(request: Request, env: Env): Response | Promise<Response> {
  const route = ROUTES[`${request.method} ${new URL(request.url).pathname}`]
  return route ? route(request, env) : json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Unknown endpoint' } }, 404)
}
