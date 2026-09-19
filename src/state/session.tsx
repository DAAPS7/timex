import { createContext, useContext } from 'react'
import type { User } from '../../shared/domain'

export const SessionCtx = createContext<{ user: User; logout: () => void } | null>(null)

export function useSession() {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession must be used inside AuthGate')
  return ctx
}
