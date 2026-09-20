import { useState } from 'react'
import { WEEKDAYS_SHORT, formatDuration } from '../../../shared/time'
import type { Activity } from '../../../shared/domain'
import { Button, Card, Empty, Icon } from '../../components/ui'
import { useStore } from '../../state/store'
import { colorFor } from '../../utils/colors'
import { ActivityForm, PRIORITY_LABEL } from './ActivityForm'

export function ActivitiesPage() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Atividades</h1>
          <p className="muted">O que queres fazer — o motor decide quando.</p>
        </div>
        <Button onClick={() => setEditing('new')}><Icon name="plus" size={16} />Nova atividade</Button>
      </div>

      <Card>
        {state.activities.length === 0 && <Empty>Sem atividades. Cria uma ou pede ao assistente.</Empty>}
        <div className="list">
          {state.activities.map((a) => {
            const goal = state.goals.find((g) => g.id === a.goalId)
            return (
              <div key={a.id} className="list-item">
                <span className="dot" style={{ background: colorFor(a.id) }} />
                <button className="grow" onClick={() => setEditing(a)}>
                  <h3>{a.name}</h3>
                  <div className="small muted">
                    {a.sessionsPerWeek}× {formatDuration(a.sessionMinutes)} por semana
                    {a.preferredStart && ` · ${a.onlyPreferred ? 'só ' : ''}${a.preferredStart}–${a.preferredEnd}`}
                    {a.canOverlap && ` · em simultâneo${a.overlapWith?.length ? ' (' + a.overlapWith.join(', ') + ')' : ''}`}
                    {a.preferredDays.length > 0 && ` · ${a.preferredDays.map((d) => WEEKDAYS_SHORT[d]).join(', ')}`}
                    {goal && ` · ${goal.title}`}
                  </div>
                </button>
                <span className={`chip ${a.priority === 'high' || a.priority === 'critical' ? 'red' : a.priority === 'medium' ? 'accent' : ''}`}>{PRIORITY_LABEL[a.priority]}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {editing && (
        <ActivityForm
          activity={editing === 'new' ? undefined : editing} goals={state.goals} events={state.events} onClose={() => setEditing(null)}
          onSave={(activity) => { dispatch({ type: 'upsertActivity', activity }); setEditing(null) }}
          onDelete={editing === 'new' ? undefined : () => { dispatch({ type: 'deleteActivity', id: editing.id }); setEditing(null) }}
        />
      )}
    </>
  )
}
