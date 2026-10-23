import type { ReactNode } from 'react'

/** Page frame: the top bar, then the content in a centered column. The one glow sits behind the header (dark only). */
export function AppLayout({ topBar, children }: { topBar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-svh bg-glow bg-[length:100%_520px] bg-top bg-no-repeat">
      {topBar}
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-24 md:px-8">
        {children}
      </main>
    </div>
  )
}
