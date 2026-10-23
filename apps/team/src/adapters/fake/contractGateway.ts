// Spec 017, US7 without a backend: after a short wait, the mangrove contract of the team README,
// whatever PDF was chosen. Same errors as the API.

import type { ContractGateway } from '../../application/ports'
import { CONTRACT_LIMITS, type ContractReading } from '../../domain/contracts'
import { fail, online, reply } from './store'

const READ_DELAY_MS = 1500

const MANGROVE: ContractReading = {
  name: 'Restauración de manglar en la Ciénaga Grande',
  purpose: 'Restaurar 5 hectáreas de manglar en la Ciénaga Grande de Santa Marta con participación de la comunidad.',
  contracting_entity: 'Corpamag',
  contractor: 'Fundación Manglares Vivos',
  contract_value: 180000000,
  start_date: '2026-08-03',
  end_date: '2027-01-31',
  duration_weeks: 26,
  lines: [
    { id: 'R1', name: 'Plántulas de mangle', amount: 45000000 },
    { id: 'R2', name: 'Mano de obra local', amount: 70000000 },
    { id: 'R3', name: 'Logística y transporte fluvial', amount: 30000000 },
    { id: 'R4', name: 'Monitoreo y talleres comunitarios', amount: 35000000 },
  ],
  obligations: [
    'Instalar un vivero de 20.000 plántulas de mangle rojo',
    'Sembrar 5 hectáreas por lotes con mano de obra local',
    'Monitorear la supervivencia y entregar informes mensuales',
  ],
  milestones: [
    { name: 'Vivero instalado', date: '2026-09-30', deliverable: 'Informe con registro fotográfico' },
    { name: 'Siembra completa', date: '2026-12-15', deliverable: 'Acta de siembra por lote' },
    { name: 'Informe final', date: '2027-01-31', deliverable: 'Informe de supervivencia' },
  ],
  description:
    'Restauración de 5 hectáreas de manglar en la Ciénaga Grande de Santa Marta, contratada por Corpamag por $180.000.000 y 26 semanas. Vivero de 20.000 plántulas, siembra por lotes con mano de obra local, monitoreo de supervivencia y talleres con la comunidad. Hitos del contrato: vivero instalado (antes del 2026-09-30), siembra completa (antes del 2026-12-15), informe final (antes del 2027-01-31).',
}

export function fakeContractGateway(): ContractGateway {
  return {
    async read(file) {
      await online()
      if (!(CONTRACT_LIMITS.uploadTypes as readonly string[]).includes(file.type) || file.size > CONTRACT_LIMITS.uploadBytes) {
        fail(422, { code: 'unsupported_file', detail: 'Sube el contrato en PDF, de hasta 10 MB.' })
      }
      await new Promise((resolve) => setTimeout(resolve, READ_DELAY_MS))
      return reply(MANGROVE)
    },
  }
}
