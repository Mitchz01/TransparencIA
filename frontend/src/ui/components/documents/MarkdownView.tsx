import type { ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'

const text = (children: ReactNode): string =>
  Array.isArray(children) ? children.map(text).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : ''

/** A spec in the app's typography. No rules between sections (design system rule 2), no monospace face. */
export function MarkdownView({ source, title }: { source: string; title?: string }) {
  const components: Components = {
    // The document's own title is already in the header.
    h1: ({ children }) => (title && text(children).trim() === title.trim() ? null : <h2 className="text-title">{children}</h2>),
    h2: ({ children }) => <h3 className="mt-4 text-heading">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-2 text-label">{children}</h4>,
    p: ({ children }) => <p className="text-body">{children}</p>,
    // A short hyphen marks list items: no round bullets anywhere (design system rule 1).
    ul: ({ children }) => <ul className="grid gap-1.5 pl-4 text-body marker:text-ink-subtle" style={{ listStyleType: '"-  "' }}>{children}</ul>,
    ol: ({ children }) => <ol className="grid list-decimal gap-1.5 pl-5 text-body marker:text-ink-subtle">{children}</ol>,
    a: ({ children, href }) => <a href={href} className="text-accent-ink underline underline-offset-2" target="_blank" rel="noreferrer">{children}</a>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    blockquote: ({ children }) => <blockquote className="grid gap-2 rounded-md bg-inset p-4 text-ink-muted">{children}</blockquote>,
    code: ({ children }) => <code className="rounded-[6px] bg-inset px-1.5 py-0.5 text-[0.9em]">{children}</code>,
    pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-inset p-4 font-sans text-label whitespace-pre-wrap [&>code]:bg-transparent [&>code]:p-0">{children}</pre>,
    hr: () => null,
    img: () => null,
  }
  return (
    <div className="grid max-w-3xl gap-3 break-words">
      <Markdown components={components}>{source}</Markdown>
    </div>
  )
}
