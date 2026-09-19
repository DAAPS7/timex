import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../../../shared/domain'
import { Button, Card } from '../../components/ui'
import { authApi, stateApi } from '../../services/api/client'
import { clearLegacyState, loadLegacyState } from '../../services/api/storage'
import { normalizeState } from '../../state/normalize'
import { emptyState } from '../../state/seed'
import { SessionCtx } from '../../state/session'
import { StoreProvider, type AppState } from '../../state/store'
import { AuthPage } from './AuthPage'

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'signedOut' }
  | { name: 'ready'; user: User; initial: AppState }

/** New account: import data left in this browser by the pre-accounts prototype, otherwise start empty (the setup wizard fills it in). */
async function firstState(): Promise<AppState> {
  const legacy = loadLegacyState()
  const state = legacy ? normalizeState(legacy) : emptyState()
  await stateApi.save(state)
  if (legacy) clearLegacyState()
  return state
}

async function loadWorkspace(user: User): Promise<Phase> {
  const data = await stateApi.load()
  return { name: 'ready', user, initial: data ? normalizeState(data) : await firstState() }
}

/** Resolves the session and the user's data before rendering the app, so pages never see a half-loaded state. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })

  const start = useCallback(async (known?: User) => {
    setPhase({ name: 'loading' })
    try {
      const user = known ?? (await authApi.me())
      setPhase(user ? await loadWorkspace(user) : { name: 'signedOut' })
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido' })
    }
  }, [])

  useEffect(() => void start(), [start])

  const logout = useCallback(() => {
    authApi.logout().finally(() => setPhase({ name: 'signedOut' }))
  }, [])

  if (phase.name === 'loading') return <div className="center-screen muted">A carregar…</div>
  if (phase.name === 'signedOut') return <AuthPage onAuthed={(user) => void start(user)} />
  if (phase.name === 'error') {
    return (
      <div className="center-screen">
        <Card className="auth-card">
          <h1>Não foi possível carregar</h1>
          <p className="muted" style={{ margin: '8px 0 16px' }}>{phase.message}</p>
          <Button onClick={() => void start()}>Tentar de novo</Button>
        </Card>
      </div>
    )
  }
  return (
    <SessionCtx.Provider value={{ user: phase.user, logout }}>
      <StoreProvider key={phase.user.id} initial={phase.initial}>{children}</StoreProvider>
    </SessionCtx.Provider>
  )
}
