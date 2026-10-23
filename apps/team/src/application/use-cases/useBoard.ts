// UC-08 to UC-10: the board, moving cards and editing tasks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardView, ChecklistItem, NewTask, Task, TaskPatch, TaskResult } from '../../domain/board'
import { moveTask, type MoveTarget } from '../../domain/rules'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useApiErrorToast, type FieldErrors } from './useApiErrorToast'

export function useBoard(projectId: number) {
  const { board } = useGateways()
  return useQuery({ queryKey: queryKeys.board(projectId), queryFn: () => board.getBoard(projectId) })
}

export interface MoveRequest extends MoveTarget {
  taskId: number
}

/** Moves show at once (spec 009, FR-005); if saving fails the card goes back and a toast offers to retry. */
export function useMoveTask(projectId: number) {
  const { board } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const key = queryKeys.board(projectId)

  const mutation = useMutation({
    mutationFn: ({ taskId, status, position, sprint_id }: MoveRequest) =>
      board.updateTask(taskId, { status, position, ...(sprint_id !== undefined && { sprint_id }) }),
    onMutate: async (move) => {
      await client.cancelQueries({ queryKey: key })
      const before = client.getQueryData<BoardView>(key)
      if (before) client.setQueryData<BoardView>(key, { ...before, tasks: moveTask(before.tasks, move.taskId, move) })
      return { before }
    },
    onError: (error, move, context) => {
      if (context?.before) client.setQueryData(key, context.before)
      reportError(error, { failure: 'No se pudo guardar el movimiento', retry: () => mutation.mutate(move), refetch: [key] })
    },
    onSettled: () => void client.invalidateQueries({ queryKey: key }),
  })
  return mutation
}

/** Edits and checklist changes on one task. Resolve with the field errors to show, or {} when saved. */
export function useTaskActions(projectId: number) {
  const { board } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const key = queryKeys.board(projectId)

  const replace = (task: Task) =>
    client.setQueryData<BoardView>(key, (view) => view && { ...view, tasks: view.tasks.map((t) => (t.id === task.id ? task : t)) })

  const run = async (call: () => Promise<TaskResult>, failure: string): Promise<{ errors: FieldErrors; result?: TaskResult }> => {
    try {
      const result = await call()
      replace(result.task)
      void client.invalidateQueries({ queryKey: key })
      return { errors: {}, result }
    } catch (error) {
      return { errors: reportError(error, { failure, form: true, refetch: [key] }) }
    }
  }

  return {
    update: (taskId: number, patch: TaskPatch) => run(() => board.updateTask(taskId, patch), 'No se guardaron los cambios'),
    setChecklist: (task: Task, items: ChecklistItem[]) => {
      // Checking an item shows at once, like a move.
      replace({ ...task, checklist: items })
      return run(() => board.setChecklist(task.id, items), 'No se guardó el checklist')
    },
  }
}

/** Adds a task at the end of its column (spec 014). Resolves with whether it was created and the field
 *  errors to show; a failure that isn't about a field shows a toast with a retry. */
export function useCreateTask(projectId: number) {
  const { board } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const key = queryKeys.board(projectId)

  const create = async (task: NewTask): Promise<{ created: boolean; errors: FieldErrors }> => {
    try {
      const { task: saved } = await board.createTask(projectId, task)
      client.setQueryData<BoardView>(key, (view) => view && { ...view, tasks: [...view.tasks.filter((t) => t.id !== saved.id), saved] })
      void client.invalidateQueries({ queryKey: key })
      return { created: true, errors: {} }
    } catch (error) {
      return { created: false, errors: reportError(error, { failure: 'No se creó la tarea', form: true, retry: () => void create(task), refetch: [key] }) }
    }
  }
  return create
}

export function useCapacity(projectId: number) {
  const { board } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  return async (points: number | null): Promise<FieldErrors> => {
    try {
      await board.setCapacity(projectId, points)
      void client.invalidateQueries({ queryKey: queryKeys.board(projectId) })
      return {}
    } catch (error) {
      return reportError(error, { failure: 'No se guardó la capacidad', form: true })
    }
  }
}
