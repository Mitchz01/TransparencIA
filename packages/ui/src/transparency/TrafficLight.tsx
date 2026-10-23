// Spec 017. Owner: P5. The traffic light and why it has that color (FR-008), computed by the backend.
import type { Light, Summary } from '@agile/domain'
import { Card } from '../Card'
import { cn } from '../cn'
import { Icon } from '../Icon'
import { Alert02Icon, Tick02Icon } from '../icons'

const LIGHTS: Record<Light, { word: string; text: string; fill: string; icon: typeof Tick02Icon }> = {
  green: { word: 'En verde', text: 'text-teal', fill: 'bg-teal-soft', icon: Tick02Icon },
  yellow: { word: 'En amarillo', text: 'text-amber', fill: 'bg-amber-soft', icon: Alert02Icon },
  red: { word: 'En rojo', text: 'text-coral', fill: 'bg-coral-soft', icon: Alert02Icon },
}

/** Never color alone: the state is always a word, and the reasons say why. */
export function TrafficLight({ summary }: { summary: Summary }) {
  const light = LIGHTS[summary.light]
  return (
    <Card aria-label="Estado del proyecto" className={cn('grid gap-3', light.fill)}>
      <p className={cn('flex items-center gap-3 text-title', light.text)}>
        <Icon icon={light.icon} size={24} />
        {light.word}
      </p>
      <ul className="grid gap-1.5 text-body text-ink">
        {summary.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </Card>
  )
}
