// Spec 017. Owner: P5. Alerts to review, never accusations (FR-004); they can be answered, never hidden (FR-014).
import type { Alert, AlertLevel } from '@agile/domain'
import { useState } from 'react'
import { Button } from '../Button'
import { TextArea } from '../Field'
import { Pill, StateLabel, type Hue } from '../Pill'
import { AiMagicIcon, Alert02Icon, Settings01Icon, Tick02Icon } from '../icons'

const LEVELS: Record<AlertLevel, { word: string; hue: Hue }> = {
  high: { word: 'Prioridad alta', hue: 'coral' },
  medium: { word: 'Prioridad media', hue: 'amber' },
  low: { word: 'Prioridad baja', hue: 'neutral' },
}

const ANSWER_MAX = 500

export function AlertList({ alerts, onAnswer }: { alerts: Alert[]; onAnswer?: (alertId: number, answer: string) => void }) {
  if (alerts.length === 0) return null
  return (
    <ul className="grid gap-2">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onAnswer={onAnswer} />
      ))}
    </ul>
  )
}

function AlertItem({ alert, onAnswer }: { alert: Alert; onAnswer?: (alertId: number, answer: string) => void }) {
  const [answering, setAnswering] = useState(false)
  const [answer, setAnswer] = useState('')
  const level = LEVELS[alert.level]
  const text = answer.trim()
  return (
    <li className="grid gap-3 rounded-md bg-inset p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill hue={level.hue} icon={Alert02Icon}>
          {level.word}
        </Pill>
        <StateLabel hue="neutral" icon={alert.source === 'ai' ? AiMagicIcon : Settings01Icon}>
          {alert.source === 'ai' ? 'Detectada por IA' : 'Regla automática'}
        </StateLabel>
      </div>
      <p className="text-body">{alert.reason}</p>
      {alert.answer ? (
        <div className="grid gap-1">
          <StateLabel hue="teal" icon={Tick02Icon}>
            Respuesta del ejecutor
          </StateLabel>
          <p className="text-body text-ink-muted">{alert.answer}</p>
        </div>
      ) : (
        <span className="text-caption text-ink-muted">En revisión</span>
      )}
      {onAnswer && !alert.answer && !answering && (
        <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setAnswering(true)}>
          Responder
        </Button>
      )}
      {onAnswer && answering && (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!text) return
            onAnswer(alert.id, text)
            setAnswering(false)
            setAnswer('')
          }}
        >
          <TextArea label="Respuesta pública" rows={3} maxLength={ANSWER_MAX} value={answer} onChange={(event) => setAnswer(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!text}>
              Publicar respuesta
            </Button>
            <Button type="button" variant="quiet" size="sm" onClick={() => setAnswering(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
