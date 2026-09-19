import type { AssistantReply, AssistantRequest } from '../../shared/domain'
import type { AIProvider } from './provider'
import { ruleBasedProvider } from './providers/ruleBased'
import { createToolRunner } from './tools'

// Provider selection is centralised here. Prototype: offline rule-based interpreter (no API key needed).
// To use an LLM, add an adapter implementing AIProvider and pick it here from env config.
const provider: AIProvider = ruleBasedProvider

export async function handleAssistantMessage(req: AssistantRequest): Promise<AssistantReply> {
  const tools = createToolRunner(req.state, req.currentItems)
  const reply = await provider.respond(req.message, tools, { today: req.state.today })
  return { reply, proposals: tools.proposals, plan: tools.plan, planAdoptable: !!tools.plan && !tools.hasDrafts }
}
