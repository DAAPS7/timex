import type { ToolRunner } from './tools'

/**
 * Provider abstraction. An implementation receives the user's message plus a ToolRunner and
 * returns the reply text. A Claude/OpenAI adapter would drive its tool-use loop through
 * `tools.call(...)`; nothing else in the app knows which provider is in use.
 */
export interface AIProvider {
  respond(message: string, tools: ToolRunner, context: { today: string }): Promise<string>
}
