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
- **Agent rationale**: `primary-soft` block with `primary-soft-ink` text and the agent's icon.

## Typography

- **Geist** for everything, including task keys (`US-12`) and story points. One family only: no monospace. From Google Fonts, with Segoe UI and the system font as fallback.
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

No generic sidebar. The project screens use a **floating top bar**: the project switcher on the left, the sections as a pill group in the center (Planning, Board, Roadmap, Documents, Integrations; the active one in `primary`), and activity, theme and settings as icon buttons on the right. The live activity opens as a right drawer, not a permanent column.

## Interaction and accessibility

- Focus ring: 2px solid `focus` with a 2px offset.
- Transitions are color and opacity only, 150ms, off under `prefers-reduced-motion`. Dragging a card lifts it with `shadow-float` and a 1° tilt.
- Every text pair in the tables above passes 4.5:1 in its theme.

## Voice

- Short, direct sentences. Buttons say what happens: "Approve", "Start planning", "Publish 12 issues". Never "OK" alone.
- No exclamation marks, no emojis, no em dashes.
- Errors say what happened and how to fix it, without apologizing.
- Dates in words ("Oct 23"), numbers with tabular figures.
