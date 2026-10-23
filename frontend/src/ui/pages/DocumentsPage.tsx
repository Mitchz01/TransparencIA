import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useApproveDocuments, useDocument, useDocuments, usePendingDocuments, useRegenerate, useSaveDocument,
} from '../../application/use-cases/useDocuments'
import type { DocumentSummary } from '../../domain/documents'
import type { Proposal } from '../../domain/proposals'
import { formatDate } from '../format'
import { DocumentEditor, RegenerateDialog, VersionHistory } from '../components/documents/DocumentTools'
import { MarkdownView } from '../components/documents/MarkdownView'
import { MermaidView } from '../components/documents/MermaidView'
import { Button, ButtonLink, Card, cn, EmptyState, Icon, SkeletonCard, StateLabel } from '../components/ds'
import { AiMagicIcon, Alert02Icon, Edit02Icon, File01Icon, HourglassIcon, RefreshIcon, Tick02Icon } from '../components/ds/icons'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

const proposalTitle = (p: Proposal) => String((p.content as { title?: string }).title ?? p.key)
const proposalText = (p: Proposal) => {
  const c = p.content as { markdown?: string; mermaid?: string }
  return c.markdown ?? c.mermaid ?? ''
}

function DocumentList({ documents, selected, onSelect, phases }: {
  documents: DocumentSummary[]
  selected: number | null
  onSelect: (id: number) => void
  phases: { name: string; epics: string[] }[]
}) {
  const groups: { title: string; items: DocumentSummary[] }[] = [
    { title: 'General', items: documents.filter((d) => d.kind === 'general_spec') },
    ...phases.map((phase) => ({ title: phase.name, items: documents.filter((d) => d.kind === 'epic_spec' && phase.epics.includes(d.epic_key ?? '')) })),
    { title: 'Otras épicas', items: documents.filter((d) => d.kind === 'epic_spec' && !phases.some((p) => p.epics.includes(d.epic_key ?? ''))) },
    { title: 'Diagramas', items: documents.filter((d) => d.kind === 'flow_diagram') },
  ].filter((g) => g.items.length > 0)

  return (
    <nav aria-label="Documentos" className="grid gap-4 rounded-lg bg-surface p-3">
      {groups.map((group) => (
        <section key={group.title} className="grid gap-1">
          <h2 className="px-3 pt-1 text-label font-semibold text-ink">{group.title}</h2>
          <ul className="grid gap-1">
            {group.items.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  aria-current={doc.id === selected ? 'page' : undefined}
                  onClick={() => onSelect(doc.id)}
                  className={cn(
                    'grid w-full gap-0.5 rounded-md px-3 py-2.5 text-left transition-[background-color] duration-150',
                    doc.id === selected ? 'bg-inset' : 'hover:bg-inset/60',
                  )}
                >
                  <span className="text-label">{doc.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-caption text-ink-muted">
                    <span className="tabular-nums">Versión {doc.version}</span>
                    {doc.outdated && <StateLabel hue="amber" icon={Alert02Icon} className="text-caption">Desactualizado</StateLabel>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}

function PendingDocuments({ pending, onApprove, approving }: { pending: Proposal[]; onApprove: (ids: number[]) => void; approving: boolean }) {
  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-heading">Esperan tu aprobación</h2>
          <p className="text-body text-ink-muted">El redactor de specs las armó con el plan aprobado. Ninguna cuenta hasta que la apruebes.</p>
        </div>
        {pending.length > 1 && (
          <Button variant="primary" icon={Tick02Icon} loading={approving} onClick={() => onApprove(pending.map((p) => p.id))}>Aprobar todas</Button>
        )}
      </div>
      <ul className="grid gap-1.5">
        {pending.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-inset px-4 py-3">
            <span className="grid min-w-0 gap-0.5">
              <span className="text-label">{proposalTitle(p)}</span>
              <span className="text-caption text-ink-muted">{p.rationale}</span>
            </span>
            <Button size="sm" icon={Tick02Icon} disabled={approving} onClick={() => onApprove([p.id])}>Aprobar</Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function DocumentViewer({ projectId, summary, pending }: { projectId: number; summary: DocumentSummary; pending: Proposal | undefined }) {
  const [params, setParams] = useSearchParams()
  const version = Number(params.get('version')) || undefined
  const latest = useDocument(summary.id)
  const shown = useDocument(summary.id, version && version !== summary.version ? version : undefined)
  const regenerate = useRegenerate(projectId)
  const save = useSaveDocument(projectId)
  const approve = useApproveDocuments(projectId)
  const [editing, setEditing] = useState(false)
  // The text the edit started from, so a newer version arriving meanwhile never replaces what is typed.
  const [editBase, setEditBase] = useState<string | null>(null)
  const [editVersion, setEditVersion] = useState<number | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [preview, setPreview] = useState(false)

  const doc = shown.data
  const current = latest.data
  const diagram = summary.kind === 'flow_diagram'
  const old = doc && current && doc.version !== current.version
  const setVersion = (v: number | undefined) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (v === undefined) next.delete('version')
      else next.set('version', String(v))
      return next
    }, { replace: true })

  if (!doc || !current) return <SkeletonCard lines={8} />
  const meta = current.versions.find((v) => v.version === doc.version)

  return (
    <Card as="article" padding="lg" className="grid min-w-0 gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h2 className="text-title">{doc.title}</h2>
          {meta && (
            <span className="text-caption text-ink-muted">
              {formatDate(meta.created_at)}, {meta.source === 'leader' ? 'editado por ti' : 'escrito por el redactor de specs'}
            </span>
          )}
        </div>
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <VersionHistory versions={current.versions} current={current.version} shown={doc.version} onPick={(v) => setVersion(v === current.version ? undefined : v)} />
            <Button size="sm" icon={RefreshIcon} disabled={Boolean(pending)} onClick={() => setRegenerating(true)}>Regenerar</Button>
            <Button size="sm" icon={Edit02Icon} disabled={Boolean(old)} onClick={() => { setEditBase(current.content); setEditVersion(current.version); setEditing(true) }}>Editar</Button>
          </div>
        )}
      </header>

      {old && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-inset p-4">
          <span className="text-body">Estás viendo la versión {doc.version}. La actual es la {current.version}.</span>
          <Button size="sm" onClick={() => setVersion(undefined)}>Ver la actual</Button>
        </div>
      )}

      {summary.outdated && !pending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-soft p-4">
          <StateLabel hue="amber" icon={Alert02Icon}>El plan cambió después de este documento</StateLabel>
          <Button size="sm" icon={RefreshIcon} onClick={() => setRegenerating(true)}>Regenerar</Button>
        </div>
      )}

      {pending && (
        <div className="grid gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-label"><Icon icon={HourglassIcon} />Hay una versión nueva esperando tu aprobación</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPreview(!preview)} aria-expanded={preview}>{preview ? 'Ocultar' : 'Ver la propuesta'}</Button>
              <Button size="sm" variant="primary" icon={Tick02Icon} loading={approve.isPending} onClick={() => approve.mutate([pending.id])}>Aprobar</Button>
            </div>
          </div>
          {preview && (
            <div className="rounded-md bg-surface p-4 text-ink">
              {diagram ? <MermaidView source={proposalText(pending)} title={proposalTitle(pending)} /> : <MarkdownView source={proposalText(pending)} title={proposalTitle(pending)} />}
            </div>
          )}
        </div>
      )}

      {editing ? (
        <DocumentEditor
          initial={editBase ?? current.content}
          diagram={diagram}
          onCancel={() => setEditing(false)}
          onReload={() => {
            setEditing(false)
            setEditBase(null)
            setEditVersion(null)
            void latest.refetch()
          }}
          onSave={async (content) => {
            const base = current.versions.at(-1)?.version ?? current.version
            const outcome = await save(summary.id, content, editVersion ?? base)
            if (outcome.ok) {
              setEditing(false)
              return null
            }
            return { conflict: outcome.conflict, error: outcome.errors.content }
          }}
        />
      ) : diagram ? (
        <MermaidView source={doc.content} title={doc.title} />
      ) : (
        <MarkdownView source={doc.content} title={doc.title} />
      )}

      {regenerating && (
        <RegenerateDialog title={doc.title} onClose={() => setRegenerating(false)} onRegenerate={(instructions) => regenerate(summary.id, instructions)} />
      )}
    </Card>
  )
}

export function DocumentsPage() {
  const project = useCurrentProject()
  const { data: documents, isPending } = useDocuments(project.id)
  const pending = usePendingDocuments(project.id)
  const approve = useApproveDocuments(project.id)
  const [params, setParams] = useSearchParams()
  const phases = (project.plan?.roadmap?.phases ?? []).map((p) => ({ name: p.name, epics: p.epics.map((e) => e.key) }))

  const selectedId = Number(params.get('doc')) || documents?.[0]?.id || null
  const selected = documents?.find((d) => d.id === selectedId) ?? documents?.[0]
  const keyOf = (d: DocumentSummary) => (d.kind === 'general_spec' ? 'general_spec' : d.kind === 'epic_spec' ? `epic_spec:${d.epic_key}` : null)
  const pendingFor = (d: DocumentSummary) =>
    pending.find((p) => p.key === keyOf(d) || (d.kind === 'flow_diagram' && p.key.startsWith('flow_diagram') && proposalTitle(p) === d.title))
  const newOnes = pending.filter((p) => !documents?.some((d) => pendingFor(d)?.id === p.id))

  return (
    <>
      <PageHeader title="Documentos" description="Las specs y los diagramas que escribe el redactor a partir del plan aprobado." />
      {isPending ? (
        <SkeletonCard lines={6} />
      ) : (
        <div className="grid gap-3">
          {newOnes.length > 0 && <PendingDocuments pending={newOnes} approving={approve.isPending} onApprove={(ids) => approve.mutate(ids)} />}
          {!documents?.length ? (
            newOnes.length === 0 && (
              <EmptyState
                icon={File01Icon}
                title="Todavía no hay documentos"
                action={<ButtonLink to={`/projects/${project.id}/planning`} icon={AiMagicIcon}>Ir a la planificación</ButtonLink>}
              >
                Llegan cuando el plan esté completo: la spec general, una spec por épica y los diagramas.
              </EmptyState>
            )
          ) : (
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-24">
                <DocumentList documents={documents} selected={selected?.id ?? null} phases={phases} onSelect={(id) => setParams({ doc: String(id) }, { replace: true })} />
              </div>
              {selected && <DocumentViewer key={selected.id} projectId={project.id} summary={selected} pending={pendingFor(selected)} />}
            </div>
          )}
        </div>
      )}
    </>
  )
}
