import type { HTMLAttributes } from 'react'
import { cn } from './cn'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div'
  /** "inset" is a block inside a card: `radius-md` on `inset`. */
  tone?: 'surface' | 'inset'
  padding?: 'md' | 'lg'
}

/** A fill on a different background. No borders, no shadow, no side strokes. */
export function Card({ as: Tag = 'section', tone = 'surface', padding = 'md', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        tone === 'surface' ? 'rounded-lg bg-surface' : 'rounded-md bg-inset',
        padding === 'md' ? 'p-5' : 'p-5 sm:p-6',
        className,
      )}
      {...rest}
    />
  )
}
