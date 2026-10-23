import { cn } from './cn'

/** A placeholder block while content loads. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-surface-strong', className)} />
}

/** A card-shaped group of skeleton lines, announced once as loading. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" aria-label="Cargando" className={cn('grid gap-3 rounded-lg bg-surface p-5', className)}>
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i % 2 ? 'w-4/5' : 'w-full')} />
      ))}
    </div>
  )
}
