// Spec 017. Owner: P5. Confirmed evidence, newest first (the backend sorts it), with its citizen summary.
import type { Expense, ExpenseKind, LineStatus } from '@agile/domain'
import { Card } from '../Card'
import { Icon } from '../Icon'
import { Calendar03Icon, Coins01Icon, File01Icon, Target02Icon } from '../icons'
import { AlertList } from './AlertList'
import { cop, day } from './format'

const KINDS: Record<ExpenseKind, string> = { invoice: 'Factura', field_photo: 'Foto de campo', report: 'Informe' }

/** `lines` (optional) turns budget line ids into their names. */
export function EvidenceList({ expenses, lines = [] }: { expenses: Expense[]; lines?: LineStatus[] }) {
  const lineName = (id: string | null) => lines.find((line) => line.id === id)?.name ?? id
  return (
    <section className="grid gap-3" aria-labelledby="evidence-title">
      <h2 id="evidence-title" className="text-heading">
        Evidencias
      </h2>
      {expenses.length === 0 && <p className="text-body text-ink-muted">Todavía no hay evidencias reportadas.</p>}
      {expenses.map((expense) => (
        <Card as="article" key={expense.id} className="grid gap-4">
          <Preview expense={expense} />
          <div className="grid gap-2">
            <span className="text-label">{KINDS[expense.kind]}{expense.supplier ? ` de ${expense.supplier}` : ''}</span>
            <p className="text-body">{expense.citizen_summary}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
              {expense.date && <Fact icon={Calendar03Icon}>{day(expense.date)}</Fact>}
              {expense.amount !== null && <Fact icon={Coins01Icon}>{cop(expense.amount)}</Fact>}
              {expense.budget_line_id && <Fact icon={File01Icon}>{lineName(expense.budget_line_id)}</Fact>}
              {expense.task_title && <Fact icon={Target02Icon}>{expense.task_title}</Fact>}
            </div>
          </div>
          {expense.alerts.length > 0 && <AlertList alerts={expense.alerts} />}
        </Card>
      ))}
    </section>
  )
}

function Fact({ icon, children }: { icon: typeof File01Icon; children: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon icon={icon} size={16} />
      {children}
    </span>
  )
}

function Preview({ expense }: { expense: Expense }) {
  if (expense.mime.startsWith('image/')) {
    return (
      <a href={expense.file_url} target="_blank" rel="noreferrer">
        <img src={expense.file_url} alt={expense.citizen_summary} loading="lazy" className="aspect-video w-full rounded-md bg-inset object-cover" />
      </a>
    )
  }
  return (
    <a href={expense.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-inset p-4 text-label">
      <Icon icon={File01Icon} />
      Ver documento
    </a>
  )
}
