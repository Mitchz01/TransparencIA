import type { IconGlyph } from '../ds'
import { DeliveryTruck01Icon, Calendar03Icon, ShoppingBag01Icon, UserGroupIcon } from '../ds/icons'

export interface ProjectTemplate {
  key: string
  name: string
  summary: string
  icon: IconGlyph
  /** What fills the home's box: enough for the agents to plan from. */
  description: string
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    key: 'store',
    name: 'Tienda online',
    summary: 'Catálogo, carrito y pagos para una marca pequeña.',
    icon: ShoppingBag01Icon,
    description:
      'Una tienda online para una marca de muebles artesanales. Catálogo con filtros por material y precio, fichas con fotos y medidas, carrito, pago con tarjeta y PSE, y seguimiento del pedido por correo. Un panel para que el equipo cargue productos y gestione el inventario.',
  },
  {
    key: 'bookings',
    name: 'App de reservas',
    summary: 'Turnos por hora con pagos y recordatorios.',
    icon: Calendar03Icon,
    description:
      'Una app web de reservas para canchas de fútbol 5. Los jugadores ven la disponibilidad por sede y hora, reservan, pagan un anticipo y reciben recordatorios por WhatsApp. El administrador bloquea horarios, ve la ocupación de la semana y cobra el saldo en la cancha.',
  },
  {
    key: 'hr',
    name: 'Panel interno de RRHH',
    summary: 'Vacaciones, ausencias y onboarding en un lugar.',
    icon: UserGroupIcon,
    description:
      'Un panel interno de recursos humanos para una empresa de 200 personas. Solicitudes de vacaciones y ausencias con aprobación del líder, calendario del equipo, checklist de onboarding para nuevos ingresos y un directorio con roles y áreas. Inicio de sesión con Google Workspace.',
  },
  {
    key: 'delivery',
    name: 'App móvil de delivery',
    summary: 'Pedidos, repartidores y seguimiento en vivo.',
    icon: DeliveryTruck01Icon,
    description:
      'Una app móvil de delivery para restaurantes de barrio. El cliente arma su pedido, paga y sigue al repartidor en el mapa. Los restaurantes reciben y preparan pedidos desde una tablet, y los repartidores aceptan entregas y marcan cada paso. Comisiones y liquidación semanal.',
  },
]
