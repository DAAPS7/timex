import type { Preferences } from '../../../shared/domain'
import { Button, Card, CardHead, Field } from '../../components/ui'
import { emptyState, seedState } from '../../state/seed'
import { useStore } from '../../state/store'

export function SettingsPage() {
  const { state, dispatch } = useStore()
  const p = state.preferences
  const set = (patch: Partial<Preferences>) => dispatch({ type: 'setPreferences', preferences: { ...p, ...patch } })
  const wakingOk = p.dayEnd > p.dayStart

  return (
    <>
      <div className="page-head"><div><h1>Definições</h1><p className="muted">Preferências que o motor de planeamento respeita.</p></div></div>
      <Card>
        <CardHead title="Dia e ritmo" />
        <Field label="Fuso horário"><input className="input" value={p.timezone} onChange={(e) => set({ timezone: e.target.value })} /></Field>
        <div className="two-col">
          <Field label="Acordar (início do dia)"><input className="input" type="time" value={p.dayStart} onChange={(e) => set({ dayStart: e.target.value })} /></Field>
          <Field label="Deitar (fim do dia)"><input className="input" type="time" value={p.dayEnd} onChange={(e) => set({ dayEnd: e.target.value })} /></Field>
        </div>
        {!wakingOk && <p className="small" style={{ color: 'var(--red)', marginBottom: 12 }}>O fim do dia tem de ser depois do início.</p>}
        <div className="two-col">
          <Field label="Pausa mínima entre sessões (min)"><input className="input" type="number" min={0} max={120} step={5} value={p.minBreakMinutes} onChange={(e) => set({ minBreakMinutes: Number(e.target.value) })} /></Field>
          <Field label="Máximo planeado por dia (min)"><input className="input" type="number" min={60} max={960} step={30} value={p.maxDailyPlannedMinutes} onChange={(e) => set({ maxDailyPlannedMinutes: Number(e.target.value) })} /></Field>
        </div>
        <p className="small muted">Fora do horário acordado é considerado sono e nunca é planeado. Depois de alterar, gera o plano de novo.</p>
      </Card>
      <Card>
        <CardHead title="Dados do protótipo" />
        <p className="small muted" style={{ marginBottom: 12 }}>Os dados ficam apenas neste browser (não há conta nem base de dados ainda).</p>
        <div className="row">
          <Button variant="tinted" onClick={() => dispatch({ type: 'replace', state: seedState() })}>Repor dados de exemplo</Button>
          <Button variant="danger" onClick={() => dispatch({ type: 'replace', state: emptyState() })}>Começar do zero</Button>
        </div>
      </Card>
    </>
  )
}
