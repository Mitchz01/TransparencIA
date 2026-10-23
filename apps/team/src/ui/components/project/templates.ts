import type { IconGlyph } from '@agile/ui'
import { DropletIcon, Leaf01Icon, Road01Icon, UserGroupIcon } from '@agile/ui/icons'

export interface ProjectTemplate {
  key: string
  name: string
  summary: string
  icon: IconGlyph
  /** The contract's length in weeks. */
  weeks: number
  /** What fills the project form: enough for the agents to plan from. */
  description: string
}

/** Public projects to start from (spec 019): the kind an alcaldía, a CAR or a foundation runs. */
export const TEMPLATES: ProjectTemplate[] = [
  {
    key: 'mangrove',
    weeks: 26,
    name: 'Restauración de manglar',
    summary: 'Vivero, siembra, mantenimiento y monitoreo con la comunidad.',
    icon: Leaf01Icon,
    description:
      'Restauración de 5 hectáreas de manglar en la Ciénaga Grande de Santa Marta, contratada por Corpamag por $180.000.000 y 6 meses. Diagnóstico del sitio, vivero de 20.000 plántulas de mangle rojo, siembra por lotes con mano de obra local, mantenimiento y resiembra, monitoreo de supervivencia y talleres con la comunidad. Informes de avance mensuales para la entidad.',
  },
  {
    key: 'road',
    weeks: 39,
    name: 'Mejoramiento de vía terciaria',
    summary: 'Afirmado, obras de drenaje y señalización de una vía rural.',
    icon: Road01Icon,
    description:
      'Mejoramiento de 12 km de vía terciaria entre la cabecera municipal y la vereda El Carmen, contratado por la alcaldía por $950.000.000 y 9 meses. Estudios previos y topografía, socialización con la comunidad, afirmado y compactación por tramos, alcantarillas y cunetas, señalización y entrega con interventoría. Informes de avance mensuales y registro fotográfico por tramo.',
  },
  {
    key: 'water',
    weeks: 26,
    name: 'Agua potable en escuelas rurales',
    summary: 'Sistemas de captación y potabilización en sedes educativas.',
    icon: DropletIcon,
    description:
      'Dotación de agua potable a tres sedes educativas rurales, contratada por la gobernación por $420.000.000 y 6 meses. Diagnóstico de cada sede, diseño del sistema de captación y filtrado, compra e instalación de tanques y filtros, pruebas de calidad del agua, capacitación a docentes y padres de familia en el mantenimiento, y entrega con actas firmadas por cada rector.',
  },
  {
    key: 'community',
    weeks: 26,
    name: 'Programa de formación comunitaria',
    summary: 'Talleres, seguimiento a participantes y cierre con resultados.',
    icon: UserGroupIcon,
    description:
      'Programa de formación en emprendimiento para 200 mujeres cabeza de hogar en cuatro barrios, contratado por la secretaría de desarrollo social por $300.000.000 y 6 meses. Convocatoria e inscripción, talleres semanales por barrio, acompañamiento a planes de negocio, entrega de capital semilla con soportes, y un evento de cierre con resultados e informe final.',
  },
]
