// Spec 017. Owner: P5. Money, physical progress and time on the same 0 to 100 scale (FR-007).
import type { Summary } from '@agile/domain'
import { Card } from '../Card'
import { Comparison } from './Comparison'

export function ProgressBars({ summary }: { summary: Summary }) {
  return (
    <Card>
      <Comparison summary={summary} />
    </Card>
  )
}
