# Design Guidelines

## Visual language
Dense, information-first dashboard. Optimized for a single technical user scanning their own data — minimal chrome, no marketing polish.

## Color tokens (`app/globals.css`)
| Var | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `#4f46e5` | `#818cf8` | primary actions, focus, user/prompt accents |
| `--positive` | `#10b981` | same | output tokens, success |
| `--warning` | `#f59e0b` | same | input tokens, sub-agents, partial-failure hints |
| `--card` | `#ffffff` | `#14141a` | surface |
| `--border` | derived | derived | dividers |
| `--muted` | derived | derived | secondary text |

## Domain colors (cross-component consistency)
| Concept | Color | Where used |
|---|---|---|
| cache-read | `#0ea5e9` | tokens chart, timeline ctx bar |
| cache-creation | `#6366f1` | tokens chart, timeline ctx/work bars |
| input tokens | `var(--warning)` | tokens chart, timeline ctx bar |
| output tokens | `var(--positive)` | tokens chart, timeline ctx/work bars |
| `tool` category | `#0ea5e9` | tool tags |
| `mcp` category | `#a855f7` | tool tags |
| `skill` category | `var(--positive)` | tool tags |
| `sub_agent` category | `var(--warning)` | tool tags |

Keep these stable — users learn them across views.

## Typography
System font stack (`ui-sans-serif, system-ui, …`). Monospace for IDs, raw text, tool names.
- Section labels: `text-[10px] uppercase tracking-wider` + `--muted`
- KPI values: `.kpi-value` (24px, semibold)

## Bars / charts
- Always provide a scale reference (tooltip with absolute number)
- For per-turn token bars, use **two bars** (total + work-only) when cache-read can dominate
- Tooltips via `title=` attr are preferred over JS libs (KISS)

## Iconography
Inline SVG, 12–14px, `currentColor` so they respect text color. Don't add icon libraries unless usage exceeds ~8 distinct icons.

## Accessibility minimums
- Buttons must be `<button type="button">` with text labels (icons alone are not enough)
- Color is informative but never the only signal — pair with text count or label
- Tooltips on `cursor-help` elements for anything color-coded
