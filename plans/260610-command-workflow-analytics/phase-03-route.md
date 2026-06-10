---
phase: 3
title: Route
status: completed
priority: P2
effort: 1h
dependencies:
  - 2
---

# Phase 3: Route

# Phase 3: Activity Route (server component)

## Overview
Wire the cached aggregator to a new `/activity` App Router page. Server component does data only
(per app convention); rendering delegated to client components in Phase 4.

## Requirements
- Functional: `/activity` renders `ActivityStats` from `aggregateActivity()`.
- Non-functional: server component (no `"use client"`); never call `parseHistory` directly — go through the cached aggregator (matches `aggregate-*` rule in CLAUDE.md).

## Architecture
`src/app/activity/page.tsx` (server) → `await aggregateActivity()` → pass `ActivityStats` as props
into client chart components (Phase 4). Page owns layout shell + section headings; charts own rendering.

Match the structure of an existing route page (e.g. `src/app/page.tsx` / `src/app/projects/page.tsx`)
for heading, container, and section spacing conventions.

## Related Code Files
- Create: `src/app/activity/page.tsx`
- Read for context: `src/app/page.tsx` (server-component data-fetch pattern), `src/app/projects/page.tsx`
- Depends on: `aggregate-activity.ts` (Phase 2), client components (Phase 4)

## Implementation Steps
1. Read `src/app/page.tsx` to copy the server-component + layout idiom (container classes, section headers, metadata export if present).
2. Create `src/app/activity/page.tsx`:
   - `export default async function ActivityPage()`.
   - `const stats = await aggregateActivity();`
   - Render page shell + section placeholders, passing `stats` slices to the Phase-4 client components
     (`<CommandLeaderboard>`, `<ActivityHeatmap>`, `<PerProjectMix>`, `<KpiStrip>`, `<ClearCadence>`).
   - Add a `pricing-disclaimer`-style note only if cost is shown — it is NOT here, so omit.
3. Keep page < 80 lines; push all rendering logic into Phase-4 components.

## Success Criteria
- [ ] `/activity` resolves and server-renders without error (`pnpm dev`, visit `/activity`).
- [ ] No `"use client"` in `page.tsx`; data comes only from `aggregateActivity()`.
- [ ] Page compiles even before Phase-4 components are styled (stub-friendly import order).
- [ ] `pnpm build` clean.

## Risk Assessment
- **Phase coupling**: page imports Phase-4 components; implement components first or stub them to keep the route compilable. Mitigation: build Phase 4 components in same session right after.
- **Empty data**: when stats are zeroed (missing history.jsonl), page should render an empty-state, not crash — handled by components in Phase 4.
