import { useMutation } from '@tanstack/react-query'
import { useGateway } from './gateway'

/** The citizen chat (spec 017, US4): one question, one short answer from the portal's data. */
export function useAskCitizen(slug: string) {
  const gateway = useGateway()
  return useMutation({ mutationFn: (question: string) => gateway.ask(slug, question) })
}
