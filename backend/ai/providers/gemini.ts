// Google Gemini adapter (REST `generateContent` with function calling). Provider-specific code stays here:
// the rest of the app only sees AIProvider. The API key is a server-side secret and never reaches the client.
import { z } from 'zod'
import { REASON_TEXT } from '../../../shared/reasons'
import type { PlanningResult, ScheduledItem } from '../../../shared/domain'
import type { AIProvider } from '../provider'
import { assistantSystemPrompt } from '../prompts/assistant'
import { TOOL_NAMES, TOOL_SPECS, type ToolName } from '../tools'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_TURNS = 6 // model <-> tool round trips before giving up

interface Part {
  text?: string
  functionCall?: { name: string; args?: unknown }
  functionResponse?: { name: string; response: unknown }
}
interface Content {
  role: 'user' | 'model'
  parts?: Part[]
}
interface GenerateResponse {
  candidates?: { content?: Content }[]
  promptFeedback?: { blockReason?: string }
}

const declarations = TOOL_NAMES.map((name) => {
  const { description, args } = TOOL_SPECS[name]
  if (!args) return { name, description }
  const { $schema: _omit, ...parametersJsonSchema } = z.toJSONSchema(args, { io: 'input' }) as Record<string, unknown>
  return { name, description, parametersJsonSchema }
})

const isToolName = (name: string): name is ToolName => (TOOL_NAMES as readonly string[]).includes(name)

// The model does not need (and should not pay tokens for) the whole engine output.
function summarizePlan(plan: PlanningResult) {
  return {
    status: plan.status,
    requestedMinutes: plan.requestedMinutes,
    scheduledMinutes: plan.scheduledMinutes,
    unscheduledMinutes: plan.unscheduledMinutes,
    conflicts: plan.conflicts,
    warnings: plan.warnings,
    sessions: plan.scheduledItems.map(({ activityId, date, start, end }) => ({ activityId, date, start, end })),
  }
}

const withReasonText = (items: ScheduledItem[]) =>
  items.map(({ activityId, date, start, end, reasons }) => ({ activityId, date, start, end, why: reasons.map((r) => REASON_TEXT[r]) }))

function forModel(name: ToolName, result: unknown): unknown {
  if (name === 'generate_plan') return summarizePlan(result as PlanningResult)
  if (name === 'explain_plan') return withReasonText(result as ScheduledItem[])
  return result
}

export function createGeminiProvider(apiKey: string, model = DEFAULT_GEMINI_MODEL, fetchImpl: typeof fetch = fetch): AIProvider {
  async function generate(contents: Content[], today: string): Promise<Content> {
    const res = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: assistantSystemPrompt(today) }] },
        contents,
        tools: [{ functionDeclarations: declarations }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { temperature: 0.3 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = (await res.json()) as GenerateResponse
    const content = body.candidates?.[0]?.content
    if (!content) throw new Error(`Gemini returned no content${body.promptFeedback?.blockReason ? ` (${body.promptFeedback.blockReason})` : ''}`)
    return content
  }

  return {
    async respond(message, tools, { today }) {
      const contents: Content[] = [{ role: 'user', parts: [{ text: message }] }]
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const content = await generate(contents, today)
        const parts = content.parts ?? []
        const calls = parts.filter((p) => p.functionCall)
        if (calls.length === 0) {
          const text = parts.map((p) => p.text ?? '').join('').trim()
          if (!text) throw new Error('Gemini returned an empty reply')
          return text
        }
        contents.push(content) // echoed back unchanged (keeps any thought signatures)
        const responses: Part[] = calls.map(({ functionCall }) => {
          const { name, args } = functionCall!
          if (!isToolName(name)) return { functionResponse: { name, response: { error: `Ferramenta desconhecida: ${name}` } } }
          try {
            return { functionResponse: { name, response: { result: forModel(name, tools.call(name, args ?? {})) } } }
          } catch (e) {
            // Let the model see validation errors so it can correct itself or ask the user.
            return { functionResponse: { name, response: { error: e instanceof Error ? e.message : String(e) } } }
          }
        })
        contents.push({ role: 'user', parts: responses })
      }
      throw new Error('Gemini did not finish within the tool-call limit')
    },
  }
}
