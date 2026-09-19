import { routeApi } from '../backend/api/routes'

// Worker entry point. With `run_worker_first = ["/api/*"]` (wrangler.toml) only API calls reach this code;
// every other request is served straight from the static build in ./dist.
export default {
  fetch: (request: Request): Response | Promise<Response> => routeApi(request),
}
