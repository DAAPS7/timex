import { useState } from 'react'
import { startOfWeek, todayLocal } from '../shared/time'
import { AppShell, type Page } from './components/layout/AppShell'
import { ActivitiesPage } from './features/activities/ActivitiesPage'
import { AssistantPage } from './features/assistant/AssistantPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { Dashboard } from './features/dashboard/Dashboard'
import { GoalsPage } from './features/goals/GoalsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { SetupWizard } from './features/setup/SetupWizard'
import { useAutoPlan } from './hooks/useAutoPlan'
import { useStore } from './state/store'

const PAGES: Page[] = ['dashboard', 'calendar', 'activities', 'goals', 'assistant', 'settings']

export function App() {
  const { state } = useStore()
  const [page, setPage] = useState<Page>(() => {
    const hash = location.hash.slice(1) as Page // allows deep links such as /#calendar
    return PAGES.includes(hash) ? hash : 'dashboard'
  })
  const setupDone = !!state.preferences.setupDone
  useAutoPlan([startOfWeek(todayLocal())], setupDone) // the current week always has a plan (proposed) once there are activities

  if (!setupDone) return <SetupWizard onDone={() => setPage('calendar')} />

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
