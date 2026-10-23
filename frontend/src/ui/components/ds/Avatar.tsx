import { useState } from 'react'
import { cn } from './cn'

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

const SIZES = { sm: 'size-7 text-caption', md: 'size-control-md text-label', lg: 'size-24 text-title' } as const

interface AvatarProps {
  name: string
  /** The profile photo; without one, or if it doesn't load, the initials. */
  src?: string | null
  /** `sm` in rows and cards; `md` fills a `control-md` button (the account menu); `lg` only on the profile. */
  size?: keyof typeof SIZES
  className?: string
}

/** A photo or the initials on `surface-strong`. The name is always written next to it (visible or for screen readers only), so the avatar stays hidden from them. */
export function Avatar({ name, src, size = 'sm', className }: AvatarProps) {
  // Remembers which photo failed, so a new `src` gets its own try without an effect.
  const [failed, setFailed] = useState<string | null>(null)
  const photo = src && src !== failed ? src : null
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-strong font-semibold text-ink', SIZES[size], className)}
    >
      {photo ? (
        <img src={photo} alt="" draggable={false} decoding="async" onError={() => setFailed(photo)} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
