// The portal's explanations, shared by the home and the how-it-works page (spec 017, credibility rules).
import { AiMagicIcon, File01Icon, Settings01Icon, ViewIcon } from '@agile/ui/icons'

export const STEPS = [
  {
    icon: File01Icon,
    title: 'El ejecutor reporta con evidencia',
    body: 'Quien ejecuta el contrato sube cada factura y cada foto de campo, ligada al rubro del presupuesto y a la actividad que pagó.',
  },
  {
    icon: AiMagicIcon,
    title: 'La IA lee y señala, una persona confirma',
    body: 'La IA lee el documento, propone el monto, la fecha y el rubro, y marca lo que no cuadra. Nada se publica hasta que alguien del equipo lo confirma.',
  },
  {
    icon: Settings01Icon,
    title: 'Reglas fijas calculan los números',
    body: 'El dinero usado, el trabajo hecho, el tiempo corrido y el semáforo salen de reglas fijas sobre los gastos confirmados y el tablero de trabajo. La IA no calcula ningún número.',
  },
  {
    icon: ViewIcon,
    title: 'Cualquiera lo revisa',
    body: 'Ciudadanos, veedurías y la entidad que contrata ven el proyecto desde un enlace o un código QR, sin cuenta, y pueden hacerle preguntas.',
  },
]
