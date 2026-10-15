---
phase: 4
title: Global Context Route & Nav
status: completed
priority: P2
effort: 2h
dependencies:
  - 2
---

# Phase 4: Global Context Route & Nav

## Overview
A dedicated `/context` route comparing startup-context token cost across all projects, making the
shared-base vs project-specific split explicit, plus a sidebar nav entry.

## Requirements
- Functional: table/chart of every project's startup-context tokens (shared base + project delta),
  sorted by total; rows deep-link to `/project/[slug]`.
- Non-functional: server component fetches `aggregateContextSummary()`; only the chart (if any) is client.

## Architecture
`src/app/context/page.tsx` (server) → `await aggregateContextSummary()`.

Layout:
- Header KPI: shared base tokens (the ~12k every project pays) with explainer — "Every session in
  every project starts with this much instruction/rule context."
- Per-project table: project (link), total tokens, project-specific delta, bar for relative size.
  Since `sharedTokens` is constant, the differentiator is `projectTokens` — highlight it.
- Optional small bar chart of top-N projects by total (client `ActivityHeatmap`-style or Recharts);
  keep KISS — a CSS bar in the table column is enough for v1, no chart lib required.

Nav: add `{ href: "/context", label: "Context", icon: <svg/> }` to `NAV_ITEMS` in
`sidebar-nav-items.tsx` (follow existing `iconProps` style; `isActive` handles highlighting).

## Related Code Files
- Create: `src/app/context/page.tsx`
- Create: `src/components/context/context-comparison-table.tsx` (server or client; CSS bars, no chart lib)
- Modify: `src/components/layout/sidebar-nav-items.tsx` (add nav item)
- Read for context: `src/app/projects/page.tsx` (table + Link idiom), `src/components/activity/per-project-mix.tsx` (recent table pattern), `src/lib/format.ts`

## Implementation Steps
1. Read `src/app/projects/page.tsx` and `per-project-mix.tsx` for the table + deep-link + truncation idioms.
2. Create `context-comparison-table.tsx`: props `{ summary: StartupContextSummary }`; render shared-base
   KPI + table (project link, total tok, project-delta tok, CSS bar scaled to max total). Cap to top N
   with a "+N more" note (no silent truncation).
3. Create `app/context/page.tsx`: server component, `force-dynamic`, fetch summary, render header + table,
   empty-state when no projects.
4. Add the Context nav item to `sidebar-nav-items.tsx`.
5. `pnpm lint` + `pnpm build`; visit `/context`, verify shared base + per-project rows + working links.

## Success Criteria
- [ ] `/context` lists projects with totals = shared base + project delta; shared base shown once as a KPI.
- [ ] Rows deep-link to the correct `/project/[slug]`.
- [ ] Context nav item appears + highlights when active.
- [ ] Empty/edge: a project with no CLAUDE.md shows total == shared base, delta 0.
- [ ] `pnpm lint` + `pnpm build` clean; no new type errors.

## Risk Assessment
- **Perf for many projects**: summary reads 2 small files/project; shared block read once + cached. Fine at 89 projects; add per-project cache if it grows.
- **Visual redundancy with project panel**: `/context` is the cross-project comparison; the panel is the per-project detail. Keep the route focused on the comparison (don't dump full file contents there).
- **Nav crowding**: sidebar now has Dashboard/Projects/Activity/Context/Search — acceptable; verify spacing.
