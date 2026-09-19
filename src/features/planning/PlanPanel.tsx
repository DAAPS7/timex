import { CONFLICT_TEXT } from '../../../shared/reasons'
import { formatDuration } from '../../../shared/time'
import type { Activity, Plan } from '../../../shared/domain'
import { Button, Card, CardHead } from '../../components/ui'

const STATUS: Record<Plan['status'], { label: string; tone: string }> = {
  proposed: { label: 'Proposto', tone: 'orange' },
  accepted: { label: 'Aceite', tone: 'green' },
  modified: { label: 'Modificado', tone: 'blue' },
}
const FEASIBILITY = {
  fully_feasible: { label: 'Tudo cabe', tone: 'green' },
  partially_feasible: { label: 'Cabe parcialmente', tone: 'orange' },
  infeasible: { label: 'Não cabe', tone: 'red' },
}

interface Props {
  plan: Plan
  activities: Activity[]
  busy: boolean
  onAccept: () => void
  onRegenerate: () => void
}

/** Explains the current plan: feasibility, trade-offs and what the user can do about them. */
export function PlanPanel({ plan, activities, busy, onAccept, onRegenerate }: Props) {
  const { result } = plan
  const names = new Map(activities.map((a) => [a.id, a.name]))
  const pct = result.requestedMinutes === 0 ? 100 : Math.round((result.scheduledMinutes / result.requestedMinutes) * 100)

  return (
    <Card>
      <CardHead title="Plano da semana">
        <span className={`chip ${STATUS[plan.status].tone}`}>{STATUS[plan.status].label} · v{plan.version}</span>
        <span className={`chip ${FEASIBILITY[result.status].tone}`}>{FEASIBILITY[result.status].label}</span>
      </CardHead>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>{formatDuration(result.scheduledMinutes)} planeadas de {formatDuration(result.requestedMinutes)} pedidas</span>
        <span className="spacer" /><span>{pct}%</span>
      </div>
      <div className="bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>

      {result.conflicts.map((c) => (
        <div key={c.activityId} className="notice" style={{ marginTop: 12 }}>
          <b>{CONFLICT_TEXT[c.code]}: {names.get(c.activityId) ?? c.activityId}.</b>{' '}
          Precisa de {formatDuration(c.requestedMinutes)}, só há {formatDuration(c.scheduledMinutes)} encaixadas
          ({formatDuration(c.availableInWindowMinutes)} livres{c.deadline ? ` até ${c.deadline}` : ''}).
          <div className="small muted">Opções: usar horários menos preferidos, reduzir outras atividades ou baixar o objetivo.</div>
        </div>
      ))}
      {result.warnings.map((w, i) => (
        <div key={i} className="notice" style={{ marginTop: 8 }}>Eventos sobrepostos: {w.detail}</div>
      ))}

      <div className="row" style={{ marginTop: 16 }}>
        {plan.status !== 'accepted' && <Button onClick={onAccept}>Aceitar plano</Button>}
        <Button variant="tinted" onClick={onRegenerate} disabled={busy}>{busy ? 'A gerar…' : 'Gerar de novo'}</Button>
        <span className="small muted">Toca num bloco colorido para ver porquê e remover.</span>
      </div>
    </Card>
  )
}
