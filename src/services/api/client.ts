import type { AssistantReply, PlanningInput, PlanningResult, ScheduledItem, User, UserData } from '../../../shared/domain'

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Não consegui contactar o servidor. Em desenvolvimento, corre "npm run cf:dev".')
  }
  if (!res.ok) {
    const e = await res.json().catch(() => null)
    throw new ApiError(res.status, e?.error?.message ?? `Erro ${res.status}. Em desenvolvimento, corre "npm run cf:dev".`)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)

export const authApi = {
  /** The signed-in user, or null when there is no valid session. */
  me: () =>
    request<{ user: User }>('GET', '/api/auth/me').then(
      (r) => r.user,
      (e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e)),
    ),
  register: (email: string, password: string) => post<{ user: User }>('/api/auth/register', { email, password }).then((r) => r.user),
  login: (email: string, password: string) => post<{ user: User }>('/api/auth/login', { email, password }).then((r) => r.user),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
}

export const stateApi = {
  load: () => request<{ data: UserData | null }>('GET', '/api/state').then((r) => r.data),
  save: (data: UserData) => request<{ ok: true }>('PUT', '/api/state', data),
}

export const planningApi = {
  generate: (input: PlanningInput) => post<PlanningResult>('/api/plans/generate', input),
}

export const assistantApi = {
  send: (message: string, state: PlanningInput, currentItems?: ScheduledItem[]) =>
    post<AssistantReply>('/api/assistant/message', { message, state, currentItems }),
}
