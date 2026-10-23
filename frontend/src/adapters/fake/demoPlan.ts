// What the fake agents propose, stage by stage. Mirrors backend/app/adapters/outbound/agents/mock/data.py
// so the demo looks the same with or without a backend.

import type { Methodology, StageKey, StageOutputs, Story } from '../../domain/plan'
import type { RequestedMethodology } from '../../domain/project'

const story = (
  key: string, epic: string, title: string, points: number, role: string,
  priority: Story['priority'] = 'medium', type: Story['type'] = 'feature',
): Story => ({
  key, epic_key: epic, title, points, role, priority, type,
  description: `As a user I want to ${title.toLowerCase()} to move the product forward.`,
  acceptance_criteria: ['Works on desktop and mobile', 'Has basic tests'],
})

export const DEMO_STAGES: StageOutputs = {
  analysis: {
    summary: 'Web platform to manage projects with AI-assisted planning.',
    goals: ['Have a demoable MVP', 'Validate it with 3 real teams'],
    in_scope: ['Project and team setup', 'Kanban board', 'Phased roadmap'],
    out_of_scope: ['Billing', 'Native mobile app'],
    risks: [
      { description: 'Inconsistent LLM answers', impact: 'high', mitigation: 'Use structured outputs with a schema' },
      { description: 'Little time for the frontend', impact: 'medium', mitigation: 'Use ready-made components' },
    ],
    complexity: 'medium',
    team_gaps: ['UX design'],
  },
  methodology: {
    methodology: 'scrumban',
    rationale: 'Small team with high uncertainty: short iterations with continuous flow and WIP limits.',
    sprint_length_weeks: 2,
    ceremonies: [
      { name: 'Daily', frequency: 'Daily, 15 min', purpose: 'Sync up and unblock' },
      { name: 'Planning', frequency: 'Every 2 weeks', purpose: "Pick the iteration's work" },
      { name: 'Retro', frequency: 'Every 2 weeks', purpose: 'Improve the process' },
    ],
    wip_limits: [
      { column: 'in_progress', limit: 3 },
      { column: 'review', limit: 2 },
    ],
    alternatives: [
      { methodology: 'scrum', why_not: 'Too many ceremonies for a team of 3 or 4 people.' },
      { methodology: 'kanban', why_not: 'The team needs iteration cut-offs for demos.' },
    ],
  },
  architecture: {
    style: 'Modular monolith',
    summary: 'React SPA that consumes a FastAPI API; the agents run in the backend.',
    components: [
      { name: 'Web app', responsibility: 'UI, board and roadmap', technology: 'React + Vite' },
      { name: 'API', responsibility: 'Projects, tasks and agent streaming', technology: 'FastAPI' },
      { name: 'Agents', responsibility: 'Generate the plan', technology: 'Gemini' },
      { name: 'Database', responsibility: 'Persistence', technology: 'SQLite' },
    ],
    stack: [
      { layer: 'Frontend', technology: 'React + Tailwind', reason: 'Fast to iterate' },
      { layer: 'Backend', technology: 'FastAPI', reason: 'Async and typed' },
      { layer: 'AI', technology: 'Gemini', reason: 'Native structured outputs' },
    ],
    decisions: [{ title: 'Structured outputs', decision: 'Each agent returns JSON with a schema', rationale: "It's persisted directly as cards" }],
  },
  roadmap: {
    phases: [
      {
        name: 'Foundations', goal: 'Technical base and project setup', start_week: 1, end_week: 2,
        deliverables: ['Repo and CI', 'Project and team setup'],
        epics: [
          { key: 'EP-1', title: 'Setup', description: 'Project infrastructure' },
          { key: 'EP-2', title: 'Projects and team', description: 'Project and member management' },
        ],
      },
      {
        name: 'MVP', goal: 'Plan generation and board', start_week: 3, end_week: 4,
        deliverables: ['Agent pipeline', 'Kanban board'],
        epics: [
          { key: 'EP-3', title: 'Agents', description: 'Pipeline that generates the plan' },
          { key: 'EP-4', title: 'Board', description: 'Kanban with drag and drop' },
        ],
      },
      {
        name: 'Beta', goal: 'Polish and feedback', start_week: 5, end_week: 6,
        deliverables: ['Replanning', 'Metrics'],
        epics: [{ key: 'EP-5', title: 'Insights', description: 'Velocity and replanning' }],
      },
    ],
  },
  backlog: {
    stories: [
      story('US-1', 'EP-1', 'Set up repo and CI', 2, 'DevOps', 'high', 'chore'),
      story('US-2', 'EP-1', 'Define the data model', 3, 'Backend', 'high'),
      story('US-3', 'EP-2', 'Create a project with a description', 3, 'Frontend', 'high'),
      story('US-4', 'EP-2', 'Enter members and roles', 3, 'Frontend', 'high'),
      story('US-5', 'EP-3', 'Research the agent framework', 2, 'Backend', 'high', 'spike'),
      story('US-6', 'EP-3', 'Chain the plan agents', 8, 'Backend', 'high'),
      story('US-7', 'EP-3', 'Show agent progress', 5, 'Frontend'),
      story('US-8', 'EP-4', 'See the board by columns', 5, 'Frontend', 'high'),
      story('US-9', 'EP-4', 'Move cards with drag and drop', 3, 'Frontend'),
      story('US-10', 'EP-5', 'Replan a sprint', 8, 'Backend', 'low'),
      story('US-11', 'EP-5', 'Velocity chart', 5, 'Frontend', 'low'),
    ],
  },
  sprints: {
    sprints: [
      { number: 1, name: 'Sprint 1', goal: 'Base ready', phase: 'Foundations', story_keys: ['US-1', 'US-2', 'US-3', 'US-4'] },
      { number: 2, name: 'Sprint 2', goal: 'Plan generated by agents', phase: 'MVP', story_keys: ['US-5', 'US-6', 'US-7', 'US-8', 'US-9'] },
      { number: 3, name: 'Sprint 3', goal: 'Beta', phase: 'Beta', story_keys: ['US-10', 'US-11'] },
    ],
    assignments: [],
  },
}

/** Why each stage looks like it does, as the agent would say it. */
export const DEMO_RATIONALES: Record<StageKey, string> = {
  analysis: 'The description asks for an MVP that real teams can try, so the scope stays on planning and the board.',
  methodology: 'Small team with high uncertainty: short iterations for demos, continuous flow and WIP limits for the rest.',
  architecture: 'One deployable keeps the demo simple; ports and adapters let the agents and GitHub change without rewrites.',
  roadmap: 'Foundations first so the agents have somewhere to write; the board follows, and insights wait for real usage.',
  backlog: 'Stories are small enough for one person each, grouped by epic, with the risky agent work marked high.',
  sprints: "Each sprint closes one phase's goal; the heavy agent work sits in sprint 2, after the base is ready.",
}

const NAMES: Record<Methodology, string> = { scrum: 'Scrum', kanban: 'Kanban', scrumban: 'Scrumban', xp: 'XP', shape_up: 'Shape Up' }

/** The agents respect the methodology the leader asked for (spec 002); "auto" keeps their choice. */
export function demoStage<K extends StageKey>(key: K, requested: RequestedMethodology): StageOutputs[K] {
  const output = structuredClone(DEMO_STAGES[key])
  if (key === 'methodology' && requested !== 'auto' && requested !== 'scrumban') {
    const decision = output as StageOutputs['methodology']
    decision.methodology = requested
    decision.rationale = `You asked for ${NAMES[requested]}; the agents set it up for this team.`
    decision.alternatives = [{ methodology: 'scrumban', why_not: 'You chose another methodology.' }]
    if (requested === 'kanban') decision.ceremonies = decision.ceremonies.filter((c) => c.name !== 'Planning')
  }
  return output
}
