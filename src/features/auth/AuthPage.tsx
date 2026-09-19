import { useState, type FormEvent } from 'react'
import type { User } from '../../../shared/domain'
import { Button, Card, Field, Icon } from '../../components/ui'
import { authApi } from '../../services/api/client'

export function AuthPage({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onAuthed(await (mode === 'login' ? authApi.login : authApi.register)(email, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <Card className="auth-card">
        <div className="brand" style={{ marginBottom: 16 }}><span className="brand-mark"><Icon name="clock" size={20} /></span>Timex</div>
        <h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="muted" style={{ margin: '4px 0 18px' }}>
          {mode === 'login' ? 'Continua onde ficaste.' : 'Os teus dados ficam guardados na tua conta.'}
        </p>
        <form onSubmit={submit}>
          <Field label="Email">
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Palavra-passe">
            <input
              className="input" type="password" required minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {mode === 'register' && <p className="small muted" style={{ marginBottom: 12 }}>Pelo menos 8 caracteres.</p>}
          {error && <p className="small" role="alert" style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
          <Button type="submit" disabled={busy} style={{ width: '100%' }}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
        </form>
        <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>
          {mode === 'login' ? 'Ainda não tens conta? ' : 'Já tens conta? '}
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
            {mode === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </Card>
    </div>
  )
}
