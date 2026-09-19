import type { Env } from '../../backend/core/env'
import { routeApi } from '../../backend/api/routes'

// Pages Functions catch-all: every /api/* request goes through the same router as the Worker.
export const onRequest: PagesFunction<Env> = ({ request, env }) => routeApi(request, env)
