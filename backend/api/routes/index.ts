import { assistantRequestSchema, planningInputSchema } from '../../../shared/domain'
import { handleAssistantMessage } from '../../ai/assistantService'
import { generatePlan } from '../../domains/planning/engine'
import { handle, json, parseBody } from '../http'

// Route handlers are plain (Request) => Response so they can be mounted by the Worker entry
// (worker/index.ts) and by Cloudflare Pages Functions (functions/api/*) without duplication.

export const health = (): Response => json({ ok: true })

// Stateless in the prototype: the client sends its current data, the engine returns a proposed plan.
export const generatePlanRoute = (request: Request): Promise<Response> =>
  handle(async () => json(generatePlan(await parseBody(request, planningInputSchema))))

export const assistantMessageRoute = (request: Request): Promise<Response> =>
  handle(async () => json(await handleAssistantMessage(await parseBody(request, assistantRequestSchema))))

const ROUTES: Record<string, (request: Request) => Response | Promise<Response>> = {
  'GET /api/health': health,
  'POST /api/plans/generate': generatePlanRoute,
  'POST /api/assistant/message': assistantMessageRoute,
}

export function routeApi(request: Request): Response | Promise<Response> {
  const route = ROUTES[`${request.method} ${new URL(request.url).pathname}`]
  return route ? route(request) : json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Unknown endpoint' } }, 404)
}
