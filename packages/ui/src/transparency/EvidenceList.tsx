// Spec 017. Owner: P5. Confirmed evidence, newest first (the backend sorts it), as a grid of cards: the photo or
// document on top, then what it proves. Alerts show here only as a count; the full alert lives in AlertList.
import type { Expense, ExpenseKind, LineStatus } from '@agile/domain'
import type { ReactNode } from 'react'
import { cn } from '../cn'
import { Icon } from '../Icon'
import { Pill } from '../Pill'
import { Alert02Icon, Calendar03Icon, File01Icon, Layers01Icon, Target02Icon, ViewIcon } from '../icons'
import { cop, day } from './format'

const KINDS: Record<ExpenseKind, string> = { invoice: 'Factura', field_photo: 'Foto de campo', report: 'Informe' }

/** `lines` (optional) turns budget line ids into their names. */
export function EvidenceList({ expenses, lines = [] }: { expenses: Expense[]; lines?: LineStatus[] }) {
  const lineName = (id: string) => lines.find((line) => line.id === id)?.name ?? id
  if (expenses.length === 0) {
    return <p className="text-body text-ink-muted">Todavía no hay evidencias reportadas.</p>
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
      {expenses.map((expense) => {
        const pending = expense.alerts.filter((alert) => !alert.answer).length
        return (
          <li key={expense.id} className="min-w-0">
            <article className="grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-lg bg-surface">
              <Media expense={expense} />
              <div className="grid content-start gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-caption text-ink-muted">{KINDS[expense.kind]}</span>
                  {expense.date && (
                    <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
                      <Icon icon={Calendar03Icon} size={16} />
                      {day(expense.date)}
                    </span>
                  )}
                </div>
                <div className="grid gap-1">
                  <h3 className="text-heading tabular-nums">{expense.amount !== null ? cop(expense.amount) : 'Evidencia de una actividad'}</h3>
                  {expense.supplier && <p className="text-label text-ink-muted">{expense.supplier}</p>}
                </div>
                <p className="text-body">{expense.citizen_summary}</p>
                <div className="grid gap-1.5 text-caption text-ink-muted">
                  {expense.budget_line_id && <Fact icon={Layers01Icon}>Rubro: {lineName(expense.budget_line_id)}</Fact>}
                  {expense.task_title && <Fact icon={Target02Icon}>Actividad: {expense.task_title}</Fact>}
                </div>
                {pending > 0 && (
                  <Pill hue="amber" icon={Alert02Icon} className="justify-self-start">
                    {pending === 1 ? '1 alerta en revisión' : `${pending} alertas en revisión`}
                  </Pill>
                )}
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}

function Fact({ icon, children }: { icon: typeof File01Icon; children: ReactNode }) {
  return (
    <span className="flex items-start gap-1.5">
      <Icon icon={icon} size={16} className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

/** The photo itself, or a document tile for a PDF; both open the file. */
function Media({ expense }: { expense: Expense }) {
  const image = expense.mime.startsWith('image/')
  return (
    <a
      href={expense.file_url}
      target="_blank"
      rel="noreferrer"
      aria-label={image ? 'Ver la foto completa' : 'Ver el documento'}
      className={cn(
        'group relative grid aspect-[16/10] place-items-center overflow-hidden',
        image ? 'bg-inset' : 'bg-primary-soft text-primary-soft-ink transition-colors hover:bg-primary-soft/70',
      )}
    >
      {image ? (
        <img src={expense.file_url} alt={expense.citizen_summary} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : (
        <span className="grid justify-items-center gap-2 text-label">
          <span className="inline-flex size-12 items-center justify-center rounded-md bg-surface">
            <Icon icon={File01Icon} size={24} />
          </span>
          {expense.mime === 'application/pdf' ? 'Ver el PDF' : 'Ver el documento'}
        </span>
      )}
      {image && (
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-pill bg-inverse/80 px-3 py-1 text-caption text-on-inverse opacity-0 transition-opacity group-hover:opacity-100">
          <Icon icon={ViewIcon} size={16} />
          Ver foto
        </span>
      )}
    </a>
  )
}
