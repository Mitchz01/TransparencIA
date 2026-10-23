// UC-11 and UC-12: read the generated specs and diagrams, regenerate them with instructions, edit them by hand.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectDocument } from '../../domain/documents'
import type { FieldErrors } from '../../domain/rules'
import { hasCode, isApiError } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { useApiErrorToast } from './useApiErrorToast'
import { useProposals } from './usePlanning'

export function useDocuments(projectId: number) {
  const { documents } = useGateways()
  return useQuery({ queryKey: queryKeys.documents(projectId), queryFn: () => documents.list(projectId) })
}

export function useDocument(documentId: number | null, version?: number) {
  const { documents } = useGateways()
  return useQuery({
    queryKey: queryKeys.document(documentId ?? 0, version),
    queryFn: () => documents.get(documentId!, version),
    enabled: documentId !== null,
  })
}

/** Document proposals waiting for the leader: new documents and regenerated versions. */
export function usePendingDocuments(projectId: number) {
  const proposals = useProposals(projectId)
  return (proposals.data ?? []).filter((p) => p.kind === 'document' && p.status === 'pending')
}

export function useApproveDocuments(projectId: number) {
  const { proposals } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()
  return useMutation({
    mutationFn: (ids: number[]) => proposals.approveMany(projectId, ids),
    onSuccess: (results) => {
      const failed = results.filter((r) => !r.ok).length
      push(
        failed
          ? { tone: 'error', message: `Se aprobaron ${results.length - failed} y ${failed} no se pudieron aprobar.` }
          : { tone: 'success', message: results.length === 1 ? 'Documento aprobado.' : `Se aprobaron ${results.length} documentos.` },
      )
    },
    onError: (error) => reportError(error, { failure: 'No se aprobaron los documentos' }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) })
      void client.invalidateQueries({ queryKey: queryKeys.documents(projectId) })
      void client.invalidateQueries({ queryKey: ['document'] })
    },
  })
}

export function useRegenerate(projectId: number) {
  const { documents } = useGateways()
  const reportError = useApiErrorToast()
  const { push } = useToasts()
  return async (documentId: number, instructions: string): Promise<FieldErrors> => {
    try {
      await documents.regenerate(documentId, instructions)
      push({ tone: 'info', message: 'Regenerando. La versión nueva llega como propuesta para que la apruebes.' })
      return {}
    } catch (error) {
      if (hasCode(error, 'regeneration_in_progress')) {
        push({ tone: 'info', message: 'Ya se está regenerando. Espera la propuesta.' })
        return {}
      }
      return reportError(error, { failure: 'No se pudo regenerar', form: true, refetch: [queryKeys.documents(projectId)] })
    }
  }
}

export type SaveOutcome = { ok: true; document: ProjectDocument } | { ok: false; conflict: number | null; errors: FieldErrors }

/** Saves a hand edit on top of the version that was loaded; someone may have saved first. */
export function useSaveDocument(projectId: number) {
  const { documents } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  return async (documentId: number, content: string, baseVersion: number): Promise<SaveOutcome> => {
    try {
      const document = await documents.save(documentId, content, baseVersion)
      client.setQueryData(queryKeys.document(documentId), document)
      void client.invalidateQueries({ queryKey: queryKeys.documents(projectId) })
      return { ok: true, document }
    } catch (error) {
      if (hasCode(error, 'version_conflict') && isApiError(error)) {
        return { ok: false, conflict: Number(error.body.current_version) || null, errors: {} }
      }
      if (hasCode(error, 'invalid_diagram') && isApiError(error)) {
        return { ok: false, conflict: null, errors: { content: (error.body.errors ?? []).map((e) => e.message).join(' ') } }
      }
      return { ok: false, conflict: null, errors: reportError(error, { failure: 'No se guardó el documento', form: true }) }
    }
  }
}
