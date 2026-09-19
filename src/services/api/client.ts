import type { AssistantReply, PlanningInput, PlanningResult, ScheduledItem } from '../../../shared/domain'

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('Não consegui contactar o servidor.')
  }
  if (!res.ok) {
    const e = await res.json().catch(() => null)
    throw new Error(e?.error?.message ?? `Erro ${res.status}. Em desenvolvimento, usa "npm run pages:dev".`)
  }
  return res.json() as Promise<T>
}

export const planningApi = {
  generate: (input: PlanningInput) => post<PlanningResult>('/api/plans/generate', input),
}

export const assistantApi = {
  send: (message: string, state: PlanningInput, currentItems?: ScheduledItem[]) =>
    post<AssistantReply>('/api/assistant/message', { message, state, currentItems }),
}
