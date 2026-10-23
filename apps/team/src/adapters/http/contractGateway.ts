import type { ContractGateway } from '../../application/ports'
import type { ContractReading } from '../../domain/contracts'
import { http } from './client'

// Spec 017, US7. The backend's contract reader (port ContractReader, D18) answers this endpoint.
export const httpContractGateway: ContractGateway = {
  read: (file) => http.upload<ContractReading>('/contracts/read', file),
}
