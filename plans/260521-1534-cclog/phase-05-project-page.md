# Phase 05 — Project Page + Leaderboards

## Overview
- **Priority:** P1
- **Status:** pending
- Route `/project/[slug]`. Per-project aggregate + session list + leaderboards (tool/MCP/skill/sub-agent).

## Layout
- Header: project real path + total sessions + lifetime tokens + lifetime cost.
- Session table (sortable): date, model, turns, total tokens, cost, duration, link.
- Leaderboards (4 cards):
  - Top tools by token cost
  - Top MCP servers by call count + tokens
  - Top skills invoked
  - Top sub-agents spawned + their costs
- Mini time-series (last 30 days) tokens/day.

## Data
- New server util `src/lib/parser/aggregate-project.ts`:
  - Iterate all sessions in dir, parse metadata-only first pass (skip large content), aggregate metrics.
  - Cache aggregate by project + mtime of newest file.

## Detection rules
- **MCP call**: tool name matches `/^mcp__/`.
- **Skill invocation**: tool name `Skill` → input.skill is the skill name.
- **Sub-agent**: tool name `Task` → input.subagent_type.

## Files
- `src/app/project/[slug]/page.tsx`
- `src/lib/parser/aggregate-project.ts`
- `src/components/project/session-table.tsx`
- `src/components/project/leaderboard-card.tsx`
- `src/components/project/usage-sparkline.tsx`

## Success
- Page loads <2s for project with 50 sessions.
- Leaderboards show non-empty data for known active projects.

## Risks
- Aggregate over many sessions slow → metadata-only first pass, lazy full parse only when user opens session.

## Todo
- [ ] aggregate-project.ts (metadata-only fast pass)
- [ ] project page.tsx
- [ ] session-table.tsx sortable
- [ ] leaderboard-card.tsx (reusable for 4 types)
- [ ] usage-sparkline.tsx
