import type { ReactNode } from 'react'
import { useStore } from '../../state/store'
import { Icon, type IconName } from '../ui'

export type Page = 'dashboard' | 'calendar' | 'activities' | 'goals' | 'assistant' | 'settings'

const NAV: { page: Page; label: string; icon: IconName }[] = [
  { page: 'dashboard', label: 'Hoje', icon: 'home' },
  { page: 'calendar', label: 'Calendário', icon: 'calendar' },
  { page: 'activities', label: 'Atividades', icon: 'bolt' },
  { page: 'goals', label: 'Objetivos', icon: 'target' },
  { page: 'assistant', label: 'Assistente', icon: 'sparkle' },
  { page: 'settings', label: 'Definições', icon: 'gear' },
]

export function AppShell({ page, onNavigate, children }: { page: Page; onNavigate: (p: Page) => void; children: ReactNode }) {
  const { syncError } = useStore()
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Navegação">
        <div className="brand"><span className="brand-mark"><Icon name="clock" size={20} /></span>Timex</div>
        {NAV.map((n) => (
          <button key={n.page} className={`nav-item ${page === n.page ? 'active' : ''}`} onClick={() => onNavigate(n.page)}>
            <Icon name={n.icon} size={22} />{n.label}
          </button>
        ))}
      </nav>
      <main className="main">
        {syncError && <div className="sync-banner" role="alert">Não foi possível guardar as últimas alterações. Vou tentar de novo na próxima alteração.</div>}
        {children}
      </main>
    </div>
  )
}
