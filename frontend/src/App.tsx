import { useState } from 'react'
import DemoCarousel from './DemoCarousel'

type LogLevel = 'info' | 'success' | 'warning' | 'error'

type LogEntry = {
  id: number
  time: string
  level: LogLevel
  message: string
}

type Preview = {
  request: string
  command: string
}

const quickActions = [
  { label: 'Encender frontales', command: 'Group 1 At 100' },
  { label: 'Apagar frontales', command: 'Group 1 At 0' },
  { label: 'Siguiente escena', command: 'Go Executor 1' },
] as const

function timeNow() {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

const initialLogs: LogEntry[] = [
  { id: 1, time: timeNow(), level: 'info', message: 'Vista demo lista. Ningún comando será enviado.' },
  { id: 2, time: timeNow(), level: 'info', message: 'Ejemplos de iluminación disponibles.' },
  { id: 3, time: timeNow(), level: 'warning', message: 'Sin conexión con grandMA2.' },
]

function App() {
  const [order, setOrder] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [isCommandFocused, setIsCommandFocused] = useState(false)

  const appendLog = (level: LogLevel, message: string) => {
    setLogs(current => [...current, { id: current.length + 1, time: timeNow(), level, message }])
  }

  const interpret = () => {
    const request = order.trim()
    if (!request) return

    const normalized = request.toLocaleLowerCase('es')
    if (['apagón general', 'apagon general', 'blackout'].includes(normalized)) {
      setPreview({ request, command: 'No disponible en Demo' })
      appendLog('warning', 'La acción de apagón general está deshabilitada en Demo.')
      return
    }

    const example = quickActions.find(action => action.label.toLocaleLowerCase('es') === normalized)
    if (example) {
      setPreview({ request, command: example.command })
      appendLog('info', `Vista previa local: ${example.command}`)
    } else {
      setPreview({ request, command: 'Pendiente de interpretación' })
      appendLog('warning', 'Esta orden aún no tiene una vista previa de ejemplo.')
    }
  }

  const clear = () => {
    setOrder('')
    setPreview(null)
    appendLog('info', 'Campo de orden limpiado.')
  }

  return (
    <div className="app-shell">
      <div className="workspace">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <header className="hero-brand">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-name">ClauCode <strong>Lights</strong><small>Lighting control workspace</small></span>
              <span className="demo-badge">Demo</span>
            </header>
            <h1 id="hero-title">Haz que la luz cobre vida.</h1>
            <p>Controla tu iluminación con lenguaje natural.<br />Escribe una instrucción y visualiza cómo se interpreta.</p>
          </div>
          <DemoCarousel pause={isCommandFocused} />
        </section>

        <main className="content-grid">
          <section className="panel command-panel" aria-labelledby="command-title">
            <div className="panel-heading"><h2 id="command-title">Tu espacio de control</h2></div>
            <div className="panel-body">
              <label className="sr-only" htmlFor="order">Escribe un comando</label>
              <div className="command-input">
                <textarea
                  id="order"
                  value={order}
                  onChange={event => setOrder(event.target.value)}
                  onFocus={() => setIsCommandFocused(true)}
                  onBlur={() => setIsCommandFocused(false)}
                  placeholder="Escribe un comando..."
                  maxLength={280}
                />
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={clear}>Limpiar</button>
                  <button className="primary-button" type="button" onClick={interpret} disabled={!order.trim()}>Interpretar orden <span aria-hidden="true">›</span></button>
                </div>
              </div>

              <div className="quick-actions">
                <h3>Ejemplos:</h3>
                <div className="action-grid">
                  {quickActions.map(action => (
                    <button
                      key={action.label}
                      type="button"
                      className="action-button"
                      onClick={() => setOrder(action.label)}
                    >{action.label}</button>
                  ))}
                </div>
              </div>

              <div className={`preview-card${preview ? '' : ' empty'}`}>
                <h3>Vista previa</h3>
                {preview
                  ? <div className="preview-content"><code>{preview.command}</code><span title={preview.request}>{preview.request}</span></div>
                  : <p className="preview-empty">La interpretación local aparecerá aquí.</p>}
              </div>
            </div>
          </section>

          <section className="panel log-panel" aria-labelledby="log-title">
            <div className="panel-heading"><h2 id="log-title">Actividad reciente</h2><div className="activity-meta"><span>{logs.length} eventos</span><span className="connection-status" role="status"><span className="status-dot" />Sin conexión · grandMA2</span></div></div>
            <div className="log-list" aria-live="polite">
              {logs.map(log => (
                <div className={`log-entry ${log.level}`} key={log.id}>
                  <span className="log-time">{log.time}</span>
                  <span className="log-indicator" aria-hidden="true" />
                  <div className="log-detail"><span className="log-level">{log.level}</span><p>{log.message}</p></div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
