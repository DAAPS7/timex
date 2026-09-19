import type { Preferences } from '../../../shared/domain'
import { Button, Card, CardHead, Field } from '../../components/ui'
import { usePlanning } from '../../hooks/usePlanning'
import { emptyState, seedState } from '../../state/seed'
import { useSession } from '../../state/session'
import { useStore } from '../../state/store'
import { CommuteFields, SleepFields } from './RoutineFields'

export function SettingsPage() {
  const { state, dispatch } = useStore()
  const { user, logout } = useSession()
  const { replanAffected } = usePlanning()
  const p = state.preferences
  const set = (patch: Partial<Preferences>) => dispatch({ type: 'setPreferences', preferences: { ...p, ...patch } })

  return (
    <>
      <div className="page-head"><div><h1>Definições</h1><p className="muted">A tua rotina e as preferências que o motor de planeamento respeita.</p></div></div>
      <Card>
        <CardHead title="Sono" />
        <SleepFields prefs={p} onChange={set} />
      </Card>
      <Card>
        <CardHead title="Transporte" />
        <CommuteFields prefs={p} onChange={set} />
      </Card>
      <Card>
        <CardHead title="Ritmo" />
        <Field label="Fuso horário"><input className="input" value={p.timezone} onChange={(e) => set({ timezone: e.target.value })} /></Field>
        <div className="two-col">
          <Field label="Pausa mínima entre sessões (min)"><input className="input" type="number" min={0} max={120} step={5} value={p.minBreakMinutes} onChange={(e) => set({ minBreakMinutes: Number(e.target.value) })} /></Field>
          <Field label="Máximo planeado por dia (min)"><input className="input" type="number" min={60} max={960} step={30} value={p.maxDailyPlannedMinutes} onChange={(e) => set({ maxDailyPlannedMinutes: Number(e.target.value) })} /></Field>
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>Ao mudar o sono, o transporte ou o ritmo, ajusta os planos existentes mantendo o que continua a caber.</p>
        <Button variant="tinted" onClick={() => void replanAffected(state)}>Ajustar planos às definições</Button>
      </Card>
      <Card>
        <CardHead title="Conta" />
        <p className="small muted" style={{ marginBottom: 12 }}>Sessão iniciada como {user.email}. Os teus dados ficam guardados na tua conta.</p>
        <div className="row">
          <Button variant="plain" onClick={logout}>Terminar sessão</Button>
          <Button variant="tinted" onClick={() => set({ setupDone: false })}>Refazer configuração guiada</Button>
        </div>
      </Card>
      <Card>
        <CardHead title="Dados" />
        <div className="row">
          <Button variant="tinted" onClick={() => dispatch({ type: 'replace', state: { ...seedState(), preferences: { ...seedState().preferences, setupDone: true } } })}>Repor dados de exemplo</Button>
          <Button variant="danger" onClick={() => dispatch({ type: 'replace', state: { ...emptyState(), preferences: { ...emptyState().preferences, setupDone: true } } })}>Começar do zero</Button>
        </div>
      </Card>
    </>
  )
}
