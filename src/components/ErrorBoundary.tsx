import { Component, type ReactNode } from 'react'

/** Shows a message instead of a blank screen when a render error happens. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <h1>Algo correu mal</h1>
          <p className="muted" style={{ margin: '8px 0 16px' }}>{this.state.error.message}</p>
          <button className="btn primary" onClick={() => location.reload()}>Recarregar</button>
        </div>
      </div>
    )
  }
}
