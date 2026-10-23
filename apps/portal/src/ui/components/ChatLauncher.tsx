// Spec 017, US4. Owner: P5. The citizen chat as a button that stays at the corner of the screen and opens a panel,
// so it's one tap away from any part of the portal. The conversation survives closing the panel.
import { AgentSpark } from '@agile/ui'
import { useEffect, useState } from 'react'
import { CitizenChat } from './CitizenChat'

export function ChatLauncher({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div
        role="dialog"
        aria-label="Pregúntale al proyecto"
        hidden={!open}
        className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[25rem]"
      >
        <CitizenChat slug={slug} autoFocus={open} onClose={() => setOpen(false)} className="h-[min(38rem,calc(100svh-1.5rem))] shadow-float sm:h-[min(40rem,calc(100svh-3rem))]" />
      </div>
      {!open && (
        <button
          type="button"
          aria-expanded={false}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 inline-flex h-14 items-center gap-3 rounded-pill bg-inverse py-2 pr-6 pl-2 text-label text-on-inverse shadow-float transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-pill bg-primary text-on-primary">
            <AgentSpark size={20} />
          </span>
          Pregúntale a la IA
        </button>
      )}
    </>
  )
}
