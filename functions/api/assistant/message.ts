import { handle, json, parseBody } from '../../../backend/api/http'
import { assistantRequestSchema } from '../../../shared/domain'
import { handleAssistantMessage } from '../../../backend/ai/assistantService'

export const onRequestPost: PagesFunction = ({ request }) =>
  handle(async () => json(await handleAssistantMessage(await parseBody(request, assistantRequestSchema))))
