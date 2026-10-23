# Skills de frontend

Skills compartidas del equipo para trabajar en `frontend/`. Claude Code las carga solas desde esta carpeta. Usan el formato abierto de Agent Skills (`SKILL.md` + archivos de referencia), así que otros asistentes pueden leerlas como contexto.

| Skill | Para qué la usamos | Se activa |
|---|---|---|
| [frontend-design](frontend-design/SKILL.md) | Dirección visual propia para la demo (paleta, tipografía, layout) y evitar el look genérico de IA | Al crear o rediseñar pantallas |
| [vercel-composition-patterns](composition-patterns/SKILL.md) | API de componentes: compound components, variantes explícitas, contexto, cambios de React 19 | Al diseñar componentes reutilizables (tarjetas, columnas, formularios) |
| [vercel-react-best-practices](react-best-practices/SKILL.md) | Rendimiento: re-renders, bundle, fetching del cliente. Clave para el kanban con dnd-kit | Al escribir o revisar componentes React |
| [web-design-guidelines](web-design-guidelines/SKILL.md) | Auditoría de UI (accesibilidad, foco, formularios, animación) con hallazgos `archivo:línea` | A pedido: `/web-design-guidelines frontend/src/**/*.tsx` |

## Notas de uso

- **react-best-practices** también trae reglas de Next.js y SSR (`server-*`, hidratación, `next/dynamic`). Nuestro front es un SPA con Vite, así que esas no aplican.
- **web-design-guidelines** baja las reglas en cada revisión desde `vercel-labs/web-interface-guidelines`. Necesita red, y las reglas pueden cambiar entre una corrida y otra.
- **frontend-design** pide confirmar el tema y armar un plan de tokens (colores, tipografía, layout) antes de escribir código. Conviene guardar ese plan en la spec 003 o 004 para que todo el equipo use la misma dirección visual.

## Origen y licencias

Copiadas sin modificaciones. Para actualizarlas, se vuelven a bajar del mismo path.

| Skill | Fuente | Commit | Licencia |
|---|---|---|---|
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | `dbd4588` | Apache 2.0 ([LICENSE.txt](frontend-design/LICENSE.txt)) |
| composition-patterns | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | `063bee9` | MIT |
| react-best-practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | `063bee9` | MIT |
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | `063bee9` | MIT |

Antes de agregar otra skill de terceros: leer su `SKILL.md` y todos sus archivos, revisar si trae scripts o pide herramientas (`allowed-tools`) y confirmar la licencia.
