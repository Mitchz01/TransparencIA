// One cache key per resource. liveUpdates.ts invalidates them when an event says something changed.

export const queryKeys = {
  me: () => ['me'] as const,
  invitation: (projectId: number) => ['invitation', projectId] as const,
  invitationPreview: (token: string) => ['invitationPreview', token] as const,
  projects: () => ['projects'] as const,
  project: (id: number) => ['project', id] as const,
  proposals: (projectId: number) => ['proposals', projectId] as const,
  proposal: (id: number) => ['proposal', id] as const,
  activity: (projectId: number) => ['activity', projectId] as const,
  planViews: (projectId: number) => ['planViews', projectId] as const,
  board: (projectId: number) => ['board', projectId] as const,
  documents: (projectId: number) => ['documents', projectId] as const,
  document: (id: number, version?: number) => ['document', id, version ?? 'latest'] as const,
}
