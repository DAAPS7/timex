import { handle, json, parseBody } from '../../../backend/api/http'
import { planningInputSchema } from '../../../shared/domain'
import { generatePlan } from '../../../backend/domains/planning/engine'

// Stateless in the prototype: the client sends its current data, the engine returns a proposed plan.
export const onRequestPost: PagesFunction = ({ request }) =>
  handle(async () => json(generatePlan(await parseBody(request, planningInputSchema))))
