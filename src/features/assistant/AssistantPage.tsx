import { useEffect, useRef, useState } from 'react'
import { Button, Card, Icon } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAssistant } from './useAssistant'

const SUGGESTIONS = [
  'Planeia a minha semana',
  'Quero estudar 6 horas esta semana e ir ao ginásio 4 vezes',
  'Consigo encaixar 3 horas de programação?',
  'Tenho um exame de Estruturas de Dados em 3 semanas',
  'Porque pões o ginásio nesses dias?',
]

export function AssistantPage() {
  const { state } = useStore()
  const { send, applyAndPlan, adoptPlan, busy } = useAssistant()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [state.chat.length])

  const submit = (message: string) => {
    setText('')
    void send(message)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assistente</h1>
          <p className="muted">Diz o que queres fazer. O assistente interpreta; o motor de planeamento decide o que cabe.</p>
        </div>
      </div>
      <Card>
        <div className="chat">
          {state.chat.length === 0 && <p className="muted">Experimenta uma destas frases:</p>}
          {state.chat.map((m) => (
            <div key={m.id} style={{ display: 'contents' }}>
              <div className={`bubble ${m.role === 'user' ? 'user' : 'bot'}`}>{m.text}</div>
              {m.proposals && m.proposals.length > 0 && (
                <div className="proposal">
                  <b>Proposta</b>
                  {m.proposals.map((p, i) => <div key={i} className="small">• {p.summary}</div>)}
                  <div className="row">
                    <Button small disabled={m.handled} onClick={() => applyAndPlan(m)}>{m.handled ? 'Aplicado' : 'Aplicar e planear'}</Button>
                  </div>
                </div>
              )}
              {m.plan && m.planAdoptable && m.plan.scheduledItems.length > 0 && (
                <div className="proposal">
                  <b>Plano proposto</b>
                  <div className="small">{m.plan.scheduledItems.length} sessões planeadas</div>
                  <div className="row"><Button small disabled={m.handled} onClick={() => adoptPlan(m)}>{m.handled ? 'Adicionado ao calendário' : 'Usar este plano'}</Button></div>
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble bot muted">A pensar…</div>}
          <div ref={end} />
        </div>
        <div className="suggestions">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => submit(s)}>{s}</button>)}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(text) }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreve ao assistente…" maxLength={1000} />
          <Button icon disabled={busy || !text.trim()} aria-label="Enviar"><Icon name="send" size={18} /></Button>
        </form>
      </Card>
    </>
  )
}
