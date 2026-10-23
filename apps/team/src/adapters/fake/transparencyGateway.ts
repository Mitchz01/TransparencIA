// Spec 017 without a backend: in memory over @agile/domain/fixtures. Owner: P4.

import type { TransparencyGateway } from '../../application/ports'
import type { FakeStore } from './store'

const todo = (): never => {
  throw new Error('fakeTransparencyGateway: not written yet (P4)')
}

export function fakeTransparencyGateway(_store: FakeStore): TransparencyGateway {
  return {
    getBudget: async () => todo(),
    setBudget: async () => todo(),
    uploadEvidence: async () => todo(),
    confirmExpense: async () => todo(),
    discardExpense: async () => todo(),
    getTeamPortal: async () => todo(),
    setPublication: async () => todo(),
    answerAlert: async () => todo(),
  }
}
