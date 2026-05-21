# Phase 06 — Global Dashboard

## Overview
- **Priority:** P1
- **Status:** pending
- Route `/`. Cross-project overview.

## Sections
1. **KPI cards**: total projects, total sessions, lifetime tokens, lifetime $cost, avg cost/session.
2. **30-day usage trend**: line chart tokens/day + cost/day (dual axis).
3. **Top projects** (table): name, sessions, tokens, cost, last-active.
4. **Model split** (donut): tokens per model id across all projects.
5. **Tool category leaderboard** (global): top 10 tools by total tokens.

## Data
- `src/lib/parser/aggregate-global.ts`:
  - Iterate `listProjects()` → call `aggregateProject(slug)` (cached).
  - Reduce to global stats.
  - Heavy → cache result in memory with 60s TTL.

## Files
- `src/app/page.tsx`
- `src/lib/parser/aggregate-global.ts`
- `src/components/global/kpi-card.tsx`
- `src/components/global/usage-trend.tsx`
- `src/components/global/top-projects-table.tsx`
- `src/components/global/model-donut.tsx`

## Success
- Dashboard loads <3s with cold cache, <500ms warm.
- Trend chart aligns with manual `find ~/.claude/projects -newer X` counts.

## Risks
- Slow first paint for users with many projects → show skeleton + stream individual cards.

## Todo
- [ ] aggregate-global.ts with 60s TTL
- [ ] page.tsx with Suspense per section
- [ ] kpi-card.tsx
- [ ] usage-trend.tsx (Recharts dual axis)
- [ ] top-projects-table.tsx
- [ ] model-donut.tsx
