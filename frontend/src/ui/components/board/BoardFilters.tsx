import { PRIORITIES, type Priority } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import type { TaskFilters } from '../../../domain/rules'
import { Button, Chip, Menu } from '../ds'
import { FilterHorizontalIcon, UserIcon } from '../ds/icons'
import { PRIORITY_LOOK } from './boardLabels'

interface BoardFiltersProps {
  filters: TaskFilters
  members: Member[]
  epics: string[]
  onChange: (filters: TaskFilters) => void
}

/** Who, how urgent, which epic. They live in the address, so a filtered board can be shared. */
export function BoardFilters({ filters, members, epics, onChange }: BoardFiltersProps) {
  const assignee = filters.assignee === undefined ? 'Todos los responsables' : filters.assignee === 'none' ? 'Sin asignar' : members.find((m) => m.id === filters.assignee)?.name ?? 'Todos'
  const active = filters.assignee !== undefined || filters.priority !== undefined || filters.epic !== undefined
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Menu
        label={`Responsable: ${assignee}`}
        icon={UserIcon}
        size="sm"
        variant="secondary"
        buttonClassName="bg-surface!"
        items={[
          { key: 'all', label: 'Todos los responsables', selected: filters.assignee === undefined, onSelect: () => onChange({ ...filters, assignee: undefined }) },
          ...members.map((m) => ({ key: String(m.id), label: m.name, caption: m.role, selected: filters.assignee === m.id, onSelect: () => onChange({ ...filters, assignee: m.id }) })),
          { key: 'none', label: 'Sin asignar', selected: filters.assignee === 'none', onSelect: () => onChange({ ...filters, assignee: 'none' }) },
        ]}
      >
        {assignee}
      </Menu>
      <Menu
        label={`Épica: ${filters.epic ?? 'Todas'}`}
        icon={FilterHorizontalIcon}
        size="sm"
        variant="secondary"
        buttonClassName="bg-surface!"
        items={[
          { key: 'all', label: 'Todas las épicas', selected: filters.epic === undefined, onSelect: () => onChange({ ...filters, epic: undefined }) },
          ...epics.map((e) => ({ key: e, label: e, selected: filters.epic === e, onSelect: () => onChange({ ...filters, epic: e }) })),
        ]}
      >
        {filters.epic ?? 'Todas las épicas'}
      </Menu>
      <div role="group" aria-label="Prioridad" className="flex gap-2">
        {PRIORITIES.map((p: Priority) => (
          <Chip key={p} pressed={filters.priority === p} onClick={() => onChange({ ...filters, priority: filters.priority === p ? undefined : p })}>
            {PRIORITY_LOOK[p].label}
          </Chip>
        ))}
      </div>
      {active && <Button size="sm" variant="quiet" onClick={() => onChange({})}>Quitar filtros</Button>}
    </div>
  )
}
