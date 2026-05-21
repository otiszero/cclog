# Phase 04 — Session View

## Overview
- **Priority:** P0 (the headline feature)
- **Status:** pending
- Route `/project/[slug]/session/[id]`. Timeline waterfall + per-turn token stacked bar + prompt/response viewer.

## Layout
```
+----------------------------------------------------------+
| Header: model · duration · total tokens · $cost         |
+----------------------------------------------------------+
| Tabs: [Timeline] [Tokens] [Prompts] [Raw]                |
+----------------------------------------------------------+
| <selected tab content>                                   |
+----------------------------------------------------------+
```

## Tabs
### Timeline (default)
- Waterfall: y-axis = events in order, x-axis = time. Each row:
  - User prompt (blue chip)
  - Assistant turn (purple bar, width ∝ duration)
  - Tool_use (nested under parent turn, color per tool category)
  - Sub_agent spawn (indented track, expandable)
- Hover → tooltip with full usage + duration + tool input preview.
- Click sub-agent → drill into child session.

### Tokens
- Stacked bar chart (Recharts) per turn: input · cache-read · cache-create · output.
- Pie: tokens by tool name (top 10).
- Pie: tokens by sub-agent type.

### Prompts
- Scrollable list of (user prompt → assistant response) pairs.
- Each pair shows tokens + cost on the right.
- Markdown render with `react-markdown` + code highlighting (`shiki` or rehype-prism).

### Raw
- Read-only viewer of jsonl (chunked, virtualized) for debugging.

## Server Action
`src/app/project/[slug]/session/[id]/page.tsx` → server component, calls `getParsed(filePath)` from cache, derives metrics, passes to client.

## Components
- `src/components/session/timeline-waterfall.tsx` (client)
- `src/components/session/tokens-charts.tsx` (client, Recharts)
- `src/components/session/prompt-viewer.tsx`
- `src/components/session/raw-viewer.tsx` (react-window for virtualization)
- `src/components/session/session-header.tsx`

## Files
- `src/app/project/[slug]/session/[id]/page.tsx`
- + components above

## Success
- Open a 50MB session and timeline renders < 2s.
- All 4 tabs work.
- Sub-agent drill-down navigates to child session.

## Risks
- Recharts perf with 500+ data points → virtualize or downsample for >200 turns.
- Markdown render heavy → lazy-load shiki.

## Todo
- [ ] session route page.tsx
- [ ] session-header.tsx
- [ ] timeline-waterfall.tsx
- [ ] tokens-charts.tsx (stacked bar + pies)
- [ ] prompt-viewer.tsx with markdown
- [ ] raw-viewer.tsx virtualized
- [ ] sub-agent drill-down link
