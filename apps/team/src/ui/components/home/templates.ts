import type { IconGlyph } from '@agile/ui'
import { Building03Icon, DropletIcon, Plant01Icon, Route01Icon } from '@agile/ui/icons'

export interface ProjectTemplate {
  key: string
  name: string
  summary: string
  icon: IconGlyph
  /** What fills the home's box: enough for the agents to plan from. */
  description: string
}

// Public works and services, the kind of contract an executing entity runs and accounts for (spec 017, FR-023).
export const TEMPLATES: ProjectTemplate[] = [
  {
    key: 'mangrove',
    name: 'Restauración de manglar',
    summary: 'Vivero, siembra y monitoreo con la comunidad.',
    icon: Plant01Icon,
    description:
      'Restauración de 5 ha de manglar en la Ciénaga Grande de Santa Marta, contratada por Corpamag por $180.000.000 durante 6 meses. Diagnóstico del sitio, vivero de 20.000 plántulas, siembra por lotes, mantenimiento, monitoreo de supervivencia y talleres con la comunidad de pescadores. Informe con fotos al cierre de cada fase.',
  },
  {
    key: 'road',
    name: 'Mejoramiento de vía terciaria',
    summary: 'Placa huella, cunetas y obras de drenaje.',
    icon: Route01Icon,
    description:
      'Mejoramiento de 3 km de vía terciaria en zona rural de Aracataca, contratado por la alcaldía por $950.000.000 durante 4 meses. Topografía y estudios, placa huella en los tramos de mayor pendiente, cunetas, alcantarillas, señalización y socialización con las juntas de acción comunal. Actas de avance de obra cada mes.',
  },
  {
    key: 'water',
    name: 'Acueducto veredal',
    summary: 'Captación, tanque y redes para una vereda.',
    icon: DropletIcon,
    description:
      'Construcción de un acueducto veredal para 120 familias en la Sierra Nevada, financiado por la gobernación por $1.200.000.000 durante 8 meses. Bocatoma, línea de conducción, tanque de almacenamiento, planta de tratamiento compacta, redes y acometidas domiciliarias, y capacitación a la junta administradora del agua.',
  },
  {
    key: 'community-hall',
    name: 'Salón comunal',
    summary: 'Obra, dotación y entrega a la comunidad.',
    icon: Building03Icon,
    description:
      'Construcción y dotación de un salón comunal de 200 m² en un barrio de Santa Marta, contratado por la alcaldía por $420.000.000 durante 5 meses. Licencias, cimentación, estructura, cubierta, acabados, baños accesibles, dotación de mobiliario y entrega formal a la junta de acción comunal con su manual de uso.',
  },
]
