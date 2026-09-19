import { useState } from 'react'
import { daysBetween, formatDuration, todayLocal } from '../../../shared/time'
import type { Goal, Priority } from '../../../shared/domain'
import { Button, Card, Empty, Field, Icon, Modal, Segmented } from '../../components/ui'
import { PRIORITY_LABEL } from '../activities/ActivityForm'
import { useStore } from '../../state/store'
import { newId } from '../../utils/ids'

const PRIORITIES = (Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => ({ value, label: PRIORITY_LABEL[value] }))

function GoalForm({ goal, onSave, onDelete, onClose }: { goal?: Goal; onSave: (g: Goal) => void; onDelete?: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [priority, setPriority] = useState<Priority>(goal?.priority ?? 'high')
  return (
    <Modal title={goal ? 'Editar objetivo' : 'Novo objetivo'} onClose={onClose}>
      <Field label="Título"><input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="Passar a Algoritmos" /></Field>
      <Field label="Prazo"><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <Field label="Prioridade"><Segmented options={PRIORITIES} value={priority} onChange={setPriority} /></Field>
      <div className="modal-actions">
        {onDelete && <Button variant="danger" onClick={onDelete}>Apagar</Button>}
        <span className="spacer" />
        <Button variant="plain" onClick={onClose}>Cancelar</Button>
        <Button disabled={!title.trim() || !deadline} onClick={() => onSave({ id: goal?.id ?? newId('g'), title: title.trim(), deadline, priority })}>Guardar</Button>
      </div>
    </Modal>
  )
}

export function GoalsPage() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const today = todayLocal()

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Objetivos</h1>
          <p className="muted">O porquê das atividades. Prazos mais próximos ganham prioridade no plano.</p>
        </div>
        <Button onClick={() => setEditing('new')}><Icon name="plus" size={16} />Novo objetivo</Button>
      </div>

      {state.goals.length === 0 && <Card><Empty>Sem objetivos. Ex.: “Exame de Algoritmos em 3 semanas”.</Empty></Card>}
      <div className="grid two">
        {state.goals.map((g) => {
          const days = daysBetween(today, g.deadline)
          const linked = state.activities.filter((a) => a.goalId === g.id)
          return (
            <button key={g.id} className="card" style={{ border: 0, textAlign: 'left', cursor: 'pointer', margin: 0 }} onClick={() => setEditing(g)}>
              <div className="row">
                <h2>{g.title}</h2><span className="spacer" />
                <span className={`chip ${g.priority === 'high' || g.priority === 'critical' ? 'red' : 'blue'}`}>{PRIORITY_LABEL[g.priority]}</span>
              </div>
              <p className={days < 0 ? '' : 'muted'} style={{ margin: '6px 0 10px', color: days < 0 ? 'var(--red)' : undefined }}>
                {days < 0 ? 'Prazo ultrapassado' : days === 0 ? 'Prazo hoje' : `Faltam ${days} dias`} · {g.deadline}
              </p>
              <div className="small muted">
                {linked.length === 0 ? 'Sem atividades associadas' : linked.map((a) => `${a.name} (${a.sessionsPerWeek}× ${formatDuration(a.sessionMinutes)})`).join(' · ')}
              </div>
            </button>
          )
        })}
      </div>

      {editing && (
        <GoalForm
          goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}
          onSave={(goal) => { dispatch({ type: 'upsertGoal', goal }); setEditing(null) }}
          onDelete={editing === 'new' ? undefined : () => { dispatch({ type: 'deleteGoal', id: editing.id }); setEditing(null) }}
        />
      )}
    </>
  )
}
