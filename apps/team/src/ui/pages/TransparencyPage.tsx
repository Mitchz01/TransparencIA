// Spec 017: the project's "Transparencia" tab (budget, expenses with evidence, alerts, publish + QR).
// Owner: P4. The read-only pieces (traffic light, bars, lines, evidence, alerts) are P5's, from
// @agile/ui/transparency, so the team sees exactly what the public portal shows.

import type { ReactNode } from 'react'
import type { Expense, LineStatus, TeamPortal } from '@agile/domain'
import { Card, EmptyState, SkeletonCard } from '@agile/ui'
import { Coins01Icon } from '@agile/ui/icons'
import { AlertList, BudgetLines, EvidenceList, ProgressBars, TrafficLight } from '@agile/ui/transparency'
import { useBoard } from '../../application/use-cases/useBoard'
import { useCanManage } from '../../application/use-cases/useSession'
import {
  useAnswerAlert, useBudget, useConfirmExpense, useDiscardExpense, useSetBudget, useSetPublication, useTeamPortal, useUploadEvidence,
} from '../../application/use-cases/useTransparency'
import { BudgetEditor } from '../components/transparency/BudgetEditor'
import { EvidenceUpload } from '../components/transparency/EvidenceUpload'
import { ExpenseReviewForm } from '../components/transparency/ExpenseReviewForm'
import { QrCard } from '../components/transparency/QrCard'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

function Section({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <Card id={id} className="grid content-start gap-4">
      <div className="grid gap-1">
        <h2 className="text-heading">{title}</h2>
        {description && <p className="text-body text-ink-muted">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

function Drafts({ projectId, drafts, lines }: { projectId: number; drafts: Expense[]; lines: LineStatus[] }) {
  const confirm = useConfirmExpense(projectId)
  const discard = useDiscardExpense(projectId)
  const { data: board } = useBoard(projectId)
  const tasks = (board?.tasks ?? []).map(({ id, title }) => ({ id, title }))
  if (drafts.length === 0) return null
  return (
    <ul className="grid gap-3" aria-label="Borradores por confirmar">
      {drafts.map((draft) => (
        <li key={draft.id} className="rounded-md bg-inset p-4 sm:p-5">
          <ExpenseReviewForm
            draft={draft}
            lines={lines}
            tasks={tasks}
            onConfirm={(body) => confirm(draft.id, body)}
            onDiscard={() => discard.mutate(draft.id)}
            discarding={discard.isPending && discard.variables === draft.id}
          />
        </li>
      ))}
    </ul>
  )
}

function Dashboard({ projectId, portal, canManage }: { projectId: number; portal: TeamPortal; canManage: boolean }) {
  const project = useCurrentProject()
  const budget = useBudget(projectId)
  const setBudget = useSetBudget(projectId)
  const { upload, uploading } = useUploadEvidence(projectId)
  const publication = useSetPublication(projectId)
  const answer = useAnswerAlert(projectId)

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="grid content-start gap-5">
          <TrafficLight summary={portal.summary} />
          <ProgressBars summary={portal.summary} />
        </Card>
        <Card>
          <QrCard
            isPublic={portal.public}
            publicUrl={portal.public_url}
            canManage={canManage}
            onChange={(isPublic) => publication.mutate(isPublic)}
            changing={publication.isPending}
          />
        </Card>
      </div>

      <Section title="Registrar gasto" description="Sube la evidencia de un gasto o de una actividad. La IA la lee, tú revisas y confirmas.">
        <EvidenceUpload upload={upload} uploading={uploading} />
        <Drafts projectId={projectId} drafts={portal.drafts} lines={portal.lines} />
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Gasto por rubro">
          <BudgetLines lines={portal.lines} />
        </Section>
        <Section id="presupuesto" title="Presupuesto" description="El contrato y sus rubros. El portal compara el gasto contra estos montos.">
          <BudgetEditor budget={budget.data ?? null} durationWeeks={project.duration_weeks} editable={canManage} onSave={setBudget} />
        </Section>
      </div>

      <Section title="Evidencias publicadas" description="Lo confirmado, del más reciente al más antiguo. Es lo que ve el público.">
        <EvidenceList expenses={portal.expenses} />
      </Section>

      <Section
        title="Alertas"
        description={canManage
          ? 'Las marca la IA o las reglas. No se pueden borrar: respóndelas y la respuesta sale en el portal.'
          : 'Las marca la IA o las reglas. Un líder del proyecto las responde en público.'}
      >
        <AlertList alerts={portal.alerts} onAnswer={canManage ? (alertId, text) => answer.mutate({ alertId, answer: text }) : undefined} />
      </Section>
    </div>
  )
}

export function TransparencyPage() {
  const project = useCurrentProject()
  const canManage = useCanManage(project.id)
  const budget = useBudget(project.id)
  const setBudget = useSetBudget(project.id)
  const hasBudget = Boolean(budget.data)
  const portal = useTeamPortal(project.id, hasBudget)

  return (
    <>
      <PageHeader
        title="Transparencia"
        description="El dinero del contrato al lado del trabajo hecho. Lo que confirmes aquí lo ve cualquiera en el portal público."
      />
      {budget.isPending || (hasBudget && portal.isPending) ? (
        <div className="grid gap-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
      ) : !hasBudget ? (
        canManage ? (
          <Section
            title="Primero, el presupuesto del contrato"
            description="Quién contrata, quién ejecuta, cuánto vale y en qué rubros se reparte. Sin presupuesto no hay con qué comparar el gasto."
          >
            <BudgetEditor budget={null} durationWeeks={project.duration_weeks} editable onSave={setBudget} startEditing />
          </Section>
        ) : (
          <EmptyState icon={Coins01Icon} title="El proyecto aún no tiene presupuesto">
            Un líder del proyecto tiene que cargar el contrato y sus rubros.
          </EmptyState>
        )
      ) : portal.data ? (
        <Dashboard projectId={project.id} portal={portal.data} canManage={canManage} />
      ) : (
        <EmptyState icon={Coins01Icon} title="No se pudo cargar la transparencia del proyecto">
          Revisa la conexión y vuelve a abrir esta pestaña.
        </EmptyState>
      )}
    </>
  )
}
