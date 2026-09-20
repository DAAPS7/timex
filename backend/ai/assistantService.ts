import type { AssistantReply, AssistantRequest } from '../../shared/domain'
import type { Env } from '../core/env'
import type { AIProvider } from './provider'
import { createGeminiProvider } from './providers/gemini'
import { ruleBasedProvider } from './providers/ruleBased'
import { createToolRunner } from './tools'

type AiEnv = Pick<Env, 'GEMINI_API_KEY' | 'GEMINI_MODEL'>

// Provider selection is centralised here. With GEMINI_API_KEY the assistant uses Gemini; the offline
// rule-based interpreter is the fallback (no key, or the Gemini call fails).
const selectProvider = (env: AiEnv): AIProvider | undefined =>
  env.GEMINI_API_KEY ? createGeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || undefined) : undefined

async function run(provider: AIProvider, req: AssistantRequest): Promise<AssistantReply> {
  // A fresh tool runner per attempt, so a failed attempt cannot leave half-made drafts behind.
  const tools = createToolRunner(req.state, req.currentItems)
  const reply = await provider.respond(req.message, tools, { today: req.state.today })
  return {
    reply,
    proposals: tools.proposals,
    plan: tools.plan,
    planWeekStart: tools.planWeekStart,
    planAdoptable: !!tools.plan && !tools.hasDrafts,
  }
}

export async function handleAssistantMessage(
  req: AssistantRequest,
  env: AiEnv = {},
  primary: AIProvider | undefined = selectProvider(env),
): Promise<AssistantReply> {
  if (primary) {
    try {
      return await run(primary, req)
    } catch (e) {
      console.error('AI provider failed, using rule-based fallback:', e)
    }
  }
  return run(ruleBasedProvider, req)
}
