import { useEffect, useState } from 'react'

const examples = [
  {
    title: 'Frontales al 50%',
    command: 'Group 1 At 50',
    action: 'Ajustar intensidad',
    group: 'Frontales',
    value: '50%',
  },
  {
    title: 'Siguiente escena',
    command: 'Go Executor 1',
    action: 'Cambiar escena',
    group: 'Escena',
    value: 'Siguiente',
  },
  {
    title: 'Apagar frontales',
    command: 'Group 1 At 0',
    action: 'Ajustar intensidad',
    group: 'Frontales',
    value: '0%',
  },
] as const

const keywords = ['Frontales', 'Intensidad', 'Escena', 'Color', 'Preset', 'GO', '50%', 'Azul', 'Blackout', 'grandMA2']

export default function DemoCarousel({ pause }: { pause: boolean }) {
  const [active, setActive] = useState(1)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const paused = pause || hovered || focused || reducedMotion

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => setActive(current => (current + 1) % examples.length), 3500)
    return () => window.clearInterval(timer)
  }, [paused])

  const example = examples[active]

  return (
    <div
      className="demo-carousel"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Ejemplos de interpretación"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div className="light-trail trail-one" aria-hidden="true" />
      <div className="light-trail trail-two" aria-hidden="true" />
      <div className="keyword-cloud" aria-label="Palabras clave de ejemplo">
        {keywords.map(word => <span key={word} className={word === 'Blackout' ? 'disabled' : ''}>{word}</span>)}
      </div>
      <div className="command-stack" aria-label="Seleccionar orden de ejemplo">
        {examples.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`stack-card card-${index}${index === active ? ' active' : ''}`}
            aria-label={`Ver interpretación: ${item.title}`}
            aria-pressed={index === active}
            onClick={() => setActive(index)}
          >
            {index === active && <span className="play-mark" aria-hidden="true" />}
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      <div className="mini-preview" key={example.title}>
        <div className="mini-preview-title"><span className="preview-light" />Interpretación del comando</div>
        <dl>
          <div><dt>Acción</dt><dd>{example.action}</dd></div>
          <div><dt>Grupo</dt><dd>{example.group}</dd></div>
          <div><dt>Valor</dt><dd>{example.value}</dd></div>
        </dl>
        <code className="sr-only">{example.command}</code>
      </div>
      <div className="carousel-dots" aria-label="Ir a un ejemplo">
        {examples.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={index === active ? 'active' : ''}
            aria-label={`Mostrar ${item.title}`}
            aria-pressed={index === active}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </div>
  )
}
