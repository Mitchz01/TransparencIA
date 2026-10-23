import type { Light } from '@agile/domain'
import type { Hue } from '@agile/ui'
import { Alert02Icon, Tick02Icon } from '@agile/ui/icons'

/** The traffic light in words, with its hue and icon: never color alone. */
export const LIGHTS: Record<Light, { word: string; hue: Hue; icon: typeof Tick02Icon }> = {
  red: { word: 'En rojo', hue: 'coral', icon: Alert02Icon },
  yellow: { word: 'En amarillo', hue: 'amber', icon: Alert02Icon },
  green: { word: 'En verde', hue: 'teal', icon: Tick02Icon },
}

export const LIGHT_ORDER: Light[] = ['red', 'yellow', 'green']
