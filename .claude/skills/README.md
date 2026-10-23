# Frontend skills

Shared team skills for working on `frontend/`. Claude Code loads them automatically from this folder. They use the open Agent Skills format (`SKILL.md` + reference files), so other assistants can read them as context.

| Skill | What we use it for | When it kicks in |
|---|---|---|
| [frontend-design](frontend-design/SKILL.md) | Our own visual direction for the demo (palette, typography, layout) and avoiding the generic AI look | When creating or redesigning screens |
| [vercel-composition-patterns](composition-patterns/SKILL.md) | Component APIs: compound components, explicit variants, context, React 19 changes | When designing reusable components (cards, columns, forms) |
| [vercel-react-best-practices](react-best-practices/SKILL.md) | Performance: re-renders, bundle, client fetching. Key for the kanban with dnd-kit | When writing or reviewing React components |
| [web-design-guidelines](web-design-guidelines/SKILL.md) | UI audit (accessibility, focus, forms, animation) with `file:line` findings | On demand: `/web-design-guidelines frontend/src/**/*.tsx` |

## Usage notes

- **react-best-practices** also includes Next.js and SSR rules (`server-*`, hydration, `next/dynamic`). Our frontend is a Vite SPA, so those don't apply.
- **web-design-guidelines** downloads its rules from `vercel-labs/web-interface-guidelines` on every review. It needs network access, and the rules can change between runs.
- **frontend-design** asks to confirm the theme and build a token plan (colors, typography, layout) before writing code. Save that plan in spec 003 or 004 so the whole team uses the same visual direction.

## Origin and licenses

Copied without changes. To update them, download them again from the same path.

| Skill | Source | Commit | License |
|---|---|---|---|
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | `dbd4588` | Apache 2.0 ([LICENSE.txt](frontend-design/LICENSE.txt)) |
| composition-patterns | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | `063bee9` | MIT |
| react-best-practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | `063bee9` | MIT |
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | `063bee9` | MIT |

Before adding another third-party skill: read its `SKILL.md` and all its files, check whether it ships scripts or asks for tools (`allowed-tools`), and confirm the license.
