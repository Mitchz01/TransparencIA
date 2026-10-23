import type { PlanningGateway } from '../../application/ports'
import type { FakePlanning } from './fakePlanning'
import { online, reply } from './store'

export function fakePlanningGateway(engine: FakePlanning): PlanningGateway {
  return {
    async start(projectId) {
      await online()
      return reply(engine.start(projectId))
    },
    async retryStage(projectId, key) {
      await online()
      return reply(engine.retryStage(projectId, key))
    },
    async replan(projectId, reason) {
      await online()
      return reply(engine.replan(projectId, reason))
    },
  }
}
