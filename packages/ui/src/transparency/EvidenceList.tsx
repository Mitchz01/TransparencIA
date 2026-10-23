// Spec 017. Owner: P5. Confirmed evidence, newest first (the backend sorts it), with its citizen summary.
// Alerts show here only as a count; the full alert lives in AlertList, so it isn't read twice.
import type { Expense, ExpenseKind, LineStatus } from '@agile/domain'
import { Card } from '../Card'
import { Icon } from '../Icon'
import { Pill } from '../Pill'
import { Alert02Icon, Calendar03Icon, Coins01Icon, File01Icon, Layers01Icon, Target02Icon } from '../icons'
import { cop, day } from './format'

const KINDS: Record<ExpenseKind, string> = { invoice: 'Factura', field_photo: 'Foto de campo', report: 'Informe' }

/** `lines` (optional) turns budget line ids into their names. */
export function EvidenceList({ expenses, lines = [] }: { expenses: Expense[]; lines?: LineStatus[] }) {
  const lineName = (id: string) => lines.find((line) => line.id === id)?.name ?? id
  if (expenses.length === 0) {
    return <p className="text-body text-ink-muted">Todavía no hay evidencias reportadas.</p>
  }
  return (
    <ul className="grid gap-3">
      {expenses.map((expense) => {
        const pending = expense.alerts.filter((alert) => !alert.answer).length
        return (
          <li key={expense.id}>
            <Card as="article" className="flex gap-4 p-4">
              <Thumbnail expense={expense} />
              <div className="grid min-w-0 flex-1 content-start gap-2">
                <div className="grid gap-0.5">
                  <h3 className="text-label">
                    {KINDS[expense.kind]}
                    {expense.supplier ? ` de ${expense.supplier}` : ''}
                  </h3>
                  <p className="text-body">{expense.citizen_summary}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
                  {expense.amount !== null && <Fact icon={Coins01Icon}>{cop(expense.amount)}</Fact>}
                  {expense.date && <Fact icon={Calendar03Icon}>{day(expense.date)}</Fact>}
                  {expense.budget_line_id && <Fact icon={Layers01Icon}>{lineName(expense.budget_line_id)}</Fact>}
                  {expense.task_title && <Fact icon={Target02Icon}>{expense.task_title}</Fact>}
                </div>
                {pending > 0 && (
                  <Pill hue="amber" icon={Alert02Icon} className="justify-self-start">
                    {pending === 1 ? '1 alerta en revisión' : `${pending} alertas en revisión`}
                  </Pill>
                )}
              </div>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

function Fact({ icon, children }: { icon: typeof File01Icon; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon icon={icon} size={16} />
      {children}
    </span>
  )
}

/** The photo itself, or a document tile for a PDF; both open the file. */
function Thumbnail({ expense }: { expense: Expense }) {
  const image = expense.mime.startsWith('image/')
  return (
    <a
      href={expense.file_url}
      target="_blank"
      rel="noreferrer"
      aria-label={image ? 'Ver la foto' : 'Ver el documento'}
      className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md bg-inset text-ink-muted"
    >
      {image ? <img src={expense.file_url} alt="" loading="lazy" className="size-full object-cover" /> : <Icon icon={File01Icon} size={24} />}
    </a>
  )
}
