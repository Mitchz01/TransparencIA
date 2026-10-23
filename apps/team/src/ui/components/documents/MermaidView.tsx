import { useEffect, useId, useState } from 'react'
import { useTheme } from '../../../application/theme'
import { FieldError, Skeleton } from '@agile/ui'

/** The diagram in the theme's colors, read from the tokens. */
function themeVariables() {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(`--${name}`).trim()
  return {
    fontFamily: token('font-sans'),
    fontSize: '14px',
    background: token('surface'),
    primaryColor: token('surface-strong'),
    primaryTextColor: token('ink'),
    primaryBorderColor: token('ink-subtle'),
    secondaryColor: token('primary-soft'),
    tertiaryColor: token('inset'),
    lineColor: token('ink-muted'),
    textColor: token('ink'),
    mainBkg: token('surface-strong'),
    nodeBorder: token('ink-subtle'),
    clusterBkg: token('inset'),
    edgeLabelBackground: token('surface'),
  }
}

type State = { status: 'drawing' } | { status: 'drawn'; svg: string } | { status: 'failed'; message: string }

/** Draws Mermaid source. If it can't be drawn, shows the source and says so, never an empty space (spec 006). */
export function MermaidView({ source, title }: { source: string; title: string }) {
  const { theme } = useTheme()
  const id = `diagram-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [state, setState] = useState<State>({ status: 'drawing' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'drawing' })
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: themeVariables() })
        await mermaid.parse(source)
        const { svg } = await mermaid.render(id, source)
        if (!cancelled) setState({ status: 'drawn', svg })
      } catch (error) {
        document.getElementById(`d${id}`)?.remove() // mermaid leaves its error drawing in the body
        if (!cancelled) setState({ status: 'failed', message: error instanceof Error ? error.message.split('\n')[0] : 'Error de sintaxis.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, theme, id])

  if (state.status === 'drawing') return <Skeleton className="h-64 w-full" />
  if (state.status === 'failed') {
    return (
      <div className="grid gap-3">
        <FieldError>No se pudo dibujar el diagrama. Revisa el código: {state.message}</FieldError>
        <pre className="overflow-x-auto rounded-md bg-inset p-4 font-sans text-label whitespace-pre-wrap">{source}</pre>
      </div>
    )
  }
  return (
    <figure className="grid gap-2">
      <div role="img" aria-label={title} className="overflow-x-auto rounded-md bg-inset p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: state.svg }} />
    </figure>
  )
}
