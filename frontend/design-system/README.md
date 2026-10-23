# Design system

Agile Planner looks calm and precise: near-black or soft off-white neutrals, one lime accent for the agents' energy, generous space and very little text. The tokens live in [src/ui/styles/tokens.css](../src/ui/styles/tokens.css); open [preview.html](preview.html) in a browser to see every combination in both themes.

Status: **Approved** (2026-10-23): palette, type and components.

## Rules that never break

1. **No status dots or circles.** A state is an icon plus a word ("Done", "Waiting for you"). No colored dots before column names, on avatars or on icons, and no circled steps in a stepper.
2. **No separator lines.** Blocks are separated by space and by a change of background (`bg` → `surface` → `surface-strong`). Never `border-bottom`, `<hr>` or lines between rows.
3. **No short lines above or below text.** No accent bars under titles, no rules over headings, no small labels on top of a title or a number ("WORKFLOW BOARD", "TOTAL BALANCE"). A value and its name share a row, or the name goes below.
4. **No em dashes.** Use a comma, a period or two sentences.
5. **No dot separators between data.** Never "Today · 15:00". Separate data with space and one icon per value.
6. **No emojis.** Icons only, from Hugeicons.
7. **No side strokes on cards.** No colored left border, no outline on one side. Cards are a fill on a different background.
8. **No KPI walls.** At most three numbers on a screen, and only when they drive a decision.

## Color

### Proportion: 80 / 15 / 5

- **80% neutrals**: `bg`, `surface`, `surface-strong`, `ink`, `ink-muted`, `ink-subtle`.
- **15% lime** (`primary`): the main action, the active navigation item, the selected option, progress fills.
- **5% categories and states**: blue, violet, amber, coral and teal, only to name a state or a category.

### Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F4F5F0` | `#0A0B09` | Page background |
| `surface` | `#FFFFFF` | `#141612` | Cards, columns, inputs, panels |
| `surface-strong` | `#E8EAE2` | `#22261E` | Pressed and hover states, progress track, a card inside a card |
| `ink` | `#12150D` | `#F2F4EE` | Main text and icons |
| `ink-muted` | `#545A4C` | `#A3A99B` | Secondary text: descriptions, metadata, inactive icons |
| `ink-subtle` | `#686E60` | `#868C7E` | Placeholders and dates only, on `bg` or `surface` |
| `primary` | `#C2EF2E` | `#C6F432` | Lime fill: main button, active nav pill, selected chip, progress bar |
| `on-primary` | `#12150D` | `#0A0B09` | Text and icons on `primary` |
| `primary-soft` | `#EEF8CC` | `#262E12` | Quiet highlight: the agent's rationale block, "approved" badge |
| `primary-soft-ink` | `#3D5600` | `#D2F55E` | Text on `primary-soft` |
| `accent-ink` | `#4A6800` | `#C6F432` | Accent text: links, the active tab label, the key of the selected task |
| `inverse` | `#12150D` | `#F2F4EE` | Tooltips, toasts, the selected segment of a segmented control |
| `on-inverse` | `#F2F4EE` | `#0A0B09` | Text on `inverse` |
| `focus` | `#2F5FE0` | `#C6F432` | Keyboard focus ring |
| `glow` | none | lime radial at 10% | One soft light behind the page header in dark mode. Never more than one per screen |
| `inset` | `#F4F5F0` | `#22261E` | Alias: a block or an input inside a card (`bg` in light, `surface-strong` in dark) |
| `scrim` | ink at 32% | black at 60% | The veil behind dialogs and drawers |
| `lane` | `#EDEFE8` | `#141612` | A board column: a step apart from `bg` (darker in light, lighter in dark) so the cards stand out on it (spec 013) |
| `card` | `#FFFFFF` | `#22261E` | A task card on a `lane`. Text on it is `ink` or `ink-muted`, never `ink-subtle` (4.45:1 in dark) |
| `card-hover` | `#F4F5F0` | `#2B3026` | A task card under the pointer |
| `card-inset` | `#E8EAE2` | `#383D31` | Something inside a task card: initials, the progress track |

Lime on the light background is **1.2:1**, so in light mode lime is always a fill with dark text on it, never text, an icon or a thin line on `bg`. Use `accent-ink` for accent text in both themes.

### Categories and states

Each hue has a text color and a soft fill; text on its soft fill passes 4.5:1 in both themes.

| Hue | Light text / soft | Dark text / soft | Meaning |
|---|---|---|---|
| `teal` | `#0B7660` / `#E0F4EF` | `#45D9B9` / `#112D27` | Success, done, low priority |
| `blue` | `#2F5FE0` / `#E8EEFD` | `#6B95FF` / `#18213A` | Info, in progress, links to GitHub |
| `amber` | `#9A5F00` / `#FBF0DA` | `#F5B83D` / `#2E2512` | Warning, waiting for approval, medium priority, WIP limit exceeded |
| `coral` | `#BF3B27` / `#FCE9E5` | `#FF8571` / `#331B16` | Error, rejected, high priority, overloaded sprint |
| `violet` | `#6A47DB` / `#EFEAFD` | `#AE95FB` / `#221C38` | Agents: the badge that says a card or document was written by an agent |

- A state is always an icon plus a word inside a soft pill, or icon plus word in the hue's text color. Color alone never carries meaning.
- Epics get a hue in this order: blue, violet, amber, teal, coral, then repeat. The hue shows only on the epic chip, never as a card background.
- Chart fills (`chart-1` to `chart-5`) are for bars, heatmap cells and areas. They're brighter than the text colors and never hold text.

### Combinations that work

- **Main action**: `primary` fill + `on-primary` text, pill shape. One per screen area.
- **Secondary action**: `surface-strong` fill + `ink` text. In dark, this is the CoinVex-style dark pill.
- **Quiet action**: no fill, `ink-muted` text and icon, `surface-strong` on hover.
- **Active navigation**: `primary` fill + `on-primary` in the top bar; everything else `ink-muted`.
- **Selected segment** (List / Board / Timeline): `inverse` fill + `on-inverse`.
- **Card**: `surface` on `bg`. A block inside a card: `surface-strong` on `surface`, or `bg` on `surface` in light mode.
- **Board**: `card` on `lane` on `bg`. The card is always the lightest of the three, so the board reads the same in light and dark.
- **Agent rationale**: `primary-soft` block with `primary-soft-ink` text and the agent's icon.

## Typography

- **Geist** for everything, including task keys (`US-12`) and story points. One family only: no monospace. Bundled with the app (variable font, so the demo never depends on the network), with Segoe UI and the system font as fallback.
- Numbers, keys and points use tabular figures (`font-variant-numeric: tabular-nums`).
- Sentence case everywhere: "Start planning", not "Start Planning" or "START PLANNING". No uppercase labels.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-display` | 36 / 1.15 | 600 | Project name on its overview. Once per app screen at most |
| `text-title` | 24 / 1.25 | 600 | Page title. One per screen |
| `text-heading` | 18 / 1.35 | 600 | Section and card titles |
| `text-body` | 15 / 1.55 | 400 | Running text, descriptions |
| `text-label` | 14 / 1.4 | 500 | Buttons, inputs, nav, column names, chips |
| `text-caption` | 13 / 1.4 | 400 | Metadata: dates, counts, assignee name. Minimum size anywhere |
| `text-number` | 32 / 1.1 | 600 | The few numbers that matter (capacity, progress) |
| `text-key` | 13 / 1.4 | 600, tabular | Task keys and points |

Headings use `letter-spacing: -0.01em`; `text-display` uses `-0.02em`.

## Shape and space

- Everything you can click is a pill (`radius-pill`): buttons, inputs, search, chips, tabs, segmented controls.
- Cards and columns `radius-lg` (24px); blocks inside a card `radius-md` (18px); small badges `radius-sm` (12px); drawers and dialogs `radius-xl` (32px).
- Space on a 4px base. Inside a card `space-5`; between cards `space-3`; between sections `space-8`; page gutter `space-8` on desktop, `space-4` on mobile.
- Controls: `control-sm` 32px (inside cards), `control-md` 40px (default), `control-lg` 48px (main actions, inputs in forms).
- Shadows only on what floats (`shadow-float`): drawers, dialogs, menus, toasts, the card being dragged. Cards on the page have no shadow.

## Icons

- **Hugeicons**, free set, stroke rounded at 1.5px: `@hugeicons/react` with `@hugeicons/core-free-icons`. No other icon set.
- 20px inside buttons, inputs and cards; 24px in navigation and headers. Color is always `currentColor`.
- Icon-only buttons are a `control-md` pill with `surface-strong` fill and an `aria-label`.

## Navigation

No wide sidebar with labels. The project screens use two pieces:

- A **rail**: a narrow `surface` column (72px, `radius-lg`, floating with a `space-3` margin) with the brand on top, the sections as 48px icon buttons in the middle (Planning, Board, Plan, Documents, Integrations; the active one is a `primary` square with `radius-md`, the rest `ink-muted`) and theme and settings at the bottom. Each icon has a tooltip with its name on the right and an accessible name.
- A **top bar**: the project switcher on the left, the views of the current section in the center as a segmented control (the sprints on the board; Roadmap, Methodology and Architecture in the plan), and activity on the right.

Under 768px the rail hides and the top bar shows a menu button with the current section, plus theme and settings. The live activity opens as a right drawer, not a permanent column.

## Components

Added for the first round of screens; all of them are in [preview.html](preview.html), section "Forms, overlays and feedback". React versions live in `src/ui/components/ds/`.

| Component | Look | Notes |
|---|---|---|
| Text field, number field, select | `control-lg` pill on `inset`, `text-label` label above, optional hint below in `ink-muted` | Error: coral icon + message under the field and a coral inner outline; the typed value stays. Number fields use tabular figures and can show a unit after the value |
| Text area | Same as a text field with `radius-md` | For descriptions and reasons |
| Checkbox | 20px square with 6px corners: `surface-strong` when empty, `primary` with a tick when checked | The label is always next to it; used by the checklist |
| On / off choice | A segmented control with two options ("Off", "On") | Instead of a switch, so the state is always a word |
| Stage stepper | One row per stage: stage name, agent name below in `ink-muted`, the state on the right as icon + word in its hue. The current stage sits on `inset`, so every state color keeps 4.5:1 | No numbers in circles and no lines between steps |
| Menu | `surface` panel, `radius-lg`, `shadow-float`, pill rows that turn `surface-strong` on hover; the chosen row has a tick | Opened from a secondary button with a chevron (project switcher, sprint selector, sections on mobile) |
| Dialog | Centered `surface` panel, `radius-xl`, `shadow-float`, on `scrim` | Title in `text-heading`, actions bottom right, Escape closes |
| Drawer | Right panel with a `space-3` margin, `radius-xl`, `shadow-float`, on `scrim` | Task details and activity. An optional header replaces the title (the task panel puts its key, epic and type there) |
| Toast | `inverse` panel, `radius-lg`, `shadow-float`, icon + message, optional "Retry" (`primary`) and the request id in `text-caption` | Bottom of the screen; errors never use red fills |
| Empty state | Icon on a 48px `surface-strong` square with `radius-md`, heading, one sentence, one action | Says what's missing and links to where it's made |
| Skeleton | `surface-strong` blocks with `radius-md`, a slow opacity pulse | No pulse under reduced motion |
| Capacity bar | Track with a `primary` fill (`coral` when overloaded) and "18 of 21 pts" next to it | Overload adds "Overloaded" with the alert icon |
| Row list | Rows on `inset` with `radius-md`, a title, an optional detail in `ink-muted` and something on the right; a group title in `text-label` above | Rows are separated by 6px of space, never by lines. Progress tracks inside a row use the `surface` track |
| Document text | Markdown in the app's type scale: `text-title`, `text-heading`, `text-body`; lists marked with a short hyphen; code on `inset` in Geist | No horizontal rules and no images; diagrams render with the theme's tokens |
| Issue badge | GitHub icon and `#12` in `blue`; closed or merged adds the word in `teal`; a broken link says so in `coral` | Inside cards, next to the key and the points |
| Replan change | A checkbox row on `inset`: the change in `text-label`, its reason below in `ink-muted` | Changes are grouped by kind (move, reassign, add, discard) under row-list group titles |
| Property rows | One row per property: a `text-label` name in `ink-muted` with its icon on the left (fixed width), the value on the right as a quiet menu button or an inline field | Spaced by 4px, no lines. The value reads as text until hovered or focused (spec 011) |
| Inline text | Text that becomes a field: no fill at rest, `inset` on hover and focus, `radius-md` | Saves on Enter or when leaving the field; Escape puts the saved value back. Errors as in any field |
| Timeline | A grid with a sticky name column and one column per week; week names in `text-caption`. Bars are progress tracks: phases 12px, epics 6px | The current week is a `primary-soft` column behind every row, never a line. Milestones are a flag icon at the end of the bar plus a row list (spec 012) |
| Flow | Steps on `inset` with `radius-md`, joined by an arrow icon in `ink-muted` (down on narrow screens) | Ends with a step that says how it repeats |
| Slots | One 12px square per allowed item, `ink-subtle` at 45%, with "Máximo 3 a la vez" next to it | For WIP limits. "Sin límite" when there's none |
| Board column | A `lane` panel with `radius-lg` and 8px of padding: the name and count in `text-label` on top, cards 8px apart below. It stretches to the tallest column; the drop target turns `primary-soft` | The empty one says "Suelta una tarea aquí" in `ink-muted` (spec 013) |
| Task card | `card` with `radius-md` and `space-4` padding: the title in `text-label` semibold (two lines at most), the checklist track when partly done, and one data row with the key, checklist, points, issue, priority as icon plus word, and the initials (or the missing role) on the right | No description; it lives in the task panel. The name behind the initials is a tooltip and screen reader text |
| Disclosure row | A row-list row whose title opens its detail, with a chevron that turns | Built on `<details>`, so it opens with Enter and Space |

## Interaction and accessibility

- Focus ring: 2px solid `focus` with a 2px offset.
- Transitions are color and opacity only, 150ms, off under `prefers-reduced-motion`. Dragging a card lifts it with `shadow-float` and a 1° tilt.
- Every text pair in the tables above passes 4.5:1 in its theme.

## Voice

The interface speaks Spanish (spec 009, FR-012); the examples below are in English like the rest of the docs. Use "tú", sentence case, and the same rules in both languages.

- Short, direct sentences. Buttons say what happens: "Approve", "Start planning", "Publish 12 issues". Never "OK" alone.
- No exclamation marks, no emojis, no em dashes.
- Errors say what happened and how to fix it, without apologizing.
- Dates in words ("Oct 23"), numbers with tabular figures.
