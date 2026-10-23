// Why these numbers can be trusted (spec 017, credibility rules), for whoever asks.
import { Card } from '@agile/ui'
import { Link } from 'react-router-dom'

export function HowToRead() {
  return (
    <Card as="div" className="text-body">
      <details className="group">
        <summary className="cursor-pointer text-label">Cómo se calculan estos números</summary>
        <ul className="mt-3 grid list-disc gap-2 pl-5 text-ink-muted">
          <li>Los porcentajes y el color los calculan reglas fijas, a partir del tablero de trabajo y de los gastos confirmados. La IA no calcula ningún número.</li>
          <li>La IA lee las facturas y las fotos y señala lo que no cuadra para que una persona lo revise. No acusa a nadie.</li>
          <li>Nada se publica hasta que alguien del equipo lo confirma. El ejecutor puede responder las alertas, pero no ocultarlas.</li>
        </ul>
        <Link to="/como-funciona" className="mt-3 inline-block text-label underline underline-offset-4">
          Ver cómo funciona el portal
        </Link>
      </details>
    </Card>
  )
}
