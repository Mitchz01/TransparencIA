import type { ReactNode } from 'react'
import { PRIORITIES, type Priority } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { activeFilterCount, type TaskFilters } from '../../../domain/rules'
import { Button, Chip, Popover } from '../ds'
import { FilterHorizontalIcon } from '../ds/icons'
import { PRIORITY_LOOK } from './boardLabels'

interface BoardFiltersProps {
  filters: TaskFilters
  members: Member[]
  epics: string[]
  onChange: (filters: TaskFilters) => void
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="grid gap-2">
      <span className="text-label text-ink-muted">{title}</span>
      <div className="flex max-w-80 flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** Who, how urgent, which epic, behind one "Filtrar" button that says how many are on (spec 014).
 *  They live in the address, so a filtered board can be shared. */
export function BoardFilters({ filters, members, epics, onChange }: BoardFiltersProps) {
  const count = activeFilterCount(filters)
  const toggle = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    onChange({ ...filters, [key]: filters[key] === value ? undefined : value })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover
        label={count ? `Filtrar, ${count} ${count === 1 ? 'activo' : 'activos'}` : 'Filtrar'}
        icon={FilterHorizontalIcon}
        size="sm"
        align="end"
        buttonClassName="bg-surface!"
        trigger={
          <>
            Filtrar
            {count > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-inverse px-1.5 text-caption text-on-inverse tabular-nums">{count}</span>}
          </>
        }
      >
        <Group title="Responsable">
          {members.map((m) => (
            <Chip key={m.id} inset pressed={filters.assignee === m.id} onClick={() => toggle('assignee', m.id)}>{m.name}</Chip>
          ))}
          <Chip inset pressed={filters.assignee === 'none'} onClick={() => toggle('assignee', 'none')}>Sin asignar</Chip>
        </Group>
        {epics.length > 0 && (
          <Group title="Épica">
            {epics.map((e) => (
              <Chip key={e} inset pressed={filters.epic === e} onClick={() => toggle('epic', e)}>{e}</Chip>
            ))}
          </Group>
        )}
        <Group title="Prioridad">
          {PRIORITIES.map((p: Priority) => (
            <Chip key={p} inset pressed={filters.priority === p} onClick={() => toggle('priority', p)}>{PRIORITY_LOOK[p].label}</Chip>
          ))}
        </Group>
      </Popover>
      {count > 0 && <Button size="sm" variant="quiet" onClick={() => onChange({})}>Quitar filtros</Button>}
    </div>
  )
}
