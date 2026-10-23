import type { ReactNode } from 'react'
import { cn } from '@agile/ui'

/** Page frame: the project's menu (inside a project), the top bar, then the content. The one glow sits behind the header (dark only). */
export function AppLayout({ topBar, rail, children }: { topBar: ReactNode; rail?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-svh bg-glow bg-[length:100%_520px] bg-top bg-no-repeat">
      {rail}
      <div className={cn(rail != null && 'lg:pl-[264px]')}>
        {topBar}
        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-24 md:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
