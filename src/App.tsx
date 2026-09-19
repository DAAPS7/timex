import { useState } from 'react'
import { AppShell, type Page } from './components/layout/AppShell'
import { ActivitiesPage } from './features/activities/ActivitiesPage'
import { AssistantPage } from './features/assistant/AssistantPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { Dashboard } from './features/dashboard/Dashboard'
import { GoalsPage } from './features/goals/GoalsPage'
import { SettingsPage } from './features/settings/SettingsPage'

const PAGES: Page[] = ['dashboard', 'calendar', 'activities', 'goals', 'assistant', 'settings']

export function App() {
  const [page, setPage] = useState<Page>(() => {
    const hash = location.hash.slice(1) as Page // allows deep links such as /#calendar
    return PAGES.includes(hash) ? hash : 'dashboard'
  })
  return (
    <AppShell page={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'activities' && <ActivitiesPage />}
      {page === 'goals' && <GoalsPage />}
      {page === 'assistant' && <AssistantPage />}
      {page === 'settings' && <SettingsPage />}
    </AppShell>
  )
}
