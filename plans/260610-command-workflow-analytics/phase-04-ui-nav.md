---
phase: 4
title: UI & Nav
status: completed
priority: P2
effort: 3h
dependencies:
  - 3
---

# Phase 4: UI Components & Nav

## Overview
Build the client chart components for `/activity` and add the nav entry. Delivers the actual
visible feature: leaderboard, heatmap, per-project mix, KPI strip, clear-cadence.

## Requirements
- Functional: render all five widgets from `ActivityStats`; per-project rows deep-link to `/project/[slug]`.
- Non-functional: client components (`"use client"`) for charts; reuse `format.ts`; match existing
  visual style (cards, spacing, color tokens) from current dashboard components.

## Architecture
Components under `src/components/activity/`:
- `kpi-strip.tsx` — total prompts, total commands, distinct projects, date span (reuse `format.ts` number/date helpers).
- `command-leaderboard.tsx` — Recharts horizontal bar; bars colored by `namespace` (ck vs builtin). Reuse Recharts setup from an existing chart component.
- `activity-heatmap.tsx` — **pure CSS grid** 7×24 (weekday rows × hour cols), cell background scaled to count (no chart lib). Legend for intensity.
- `per-project-mix.tsx` — table: project (Next `<Link href={\`/project/${slug}\`}>`), entry count, top command. Fall back to raw path text if slug has no matching project dir.
- `clear-cadence.tsx` — small stat card: `/clear` count + avg entries between clears, with one-line explainer ("context-reset cadence").

Nav: add `{ href: "/activity", label: "Activity", icon: <svg/> }` to `NAV_ITEMS` in
`src/components/layout/sidebar-nav-items.tsx` (follow existing `iconProps` + path icon style; `isActive` already handles it).

## Related Code Files
- Create: `src/components/activity/kpi-strip.tsx`
- Create: `src/components/activity/command-leaderboard.tsx`
- Create: `src/components/activity/activity-heatmap.tsx`
- Create: `src/components/activity/per-project-mix.tsx`
- Create: `src/components/activity/clear-cadence.tsx`
- Modify: `src/components/layout/sidebar-nav-items.tsx` (add nav item)
- Modify: `src/app/activity/page.tsx` (import + place the real components — finalize Phase 3 stubs)
- Read for context: an existing Recharts client component (model donut / token bars), `src/lib/format.ts`, `src/components/projects/projects-explorer.tsx` (table + Link idiom)

## Implementation Steps
1. Read an existing chart component (e.g. the model donut or per-turn token bars) for Recharts wiring, container sizing, and color tokens.
2. Build `kpi-strip.tsx` first (simplest, validates props flow).
3. Build `command-leaderboard.tsx` (Recharts `BarChart` horizontal; namespace→color map; show count labels).
4. Build `activity-heatmap.tsx` as CSS grid; intensity = `count / max` → opacity or token scale; include axis labels (Sun–Sat, 0–23) + intensity legend.
5. Build `per-project-mix.tsx` table with `<Link>` deep-links; raw-path fallback when no slug match.
6. Build `clear-cadence.tsx` stat card.
7. Add the Activity nav item to `sidebar-nav-items.tsx`.
8. Finalize `activity/page.tsx` placing all components; handle empty-state (zeroed stats → friendly "no history yet" message).
9. `pnpm lint` + `pnpm build`; visit `/activity` in `pnpm dev` and eyeball every widget.

## Success Criteria
- [ ] All five widgets render with real data; numbers match Phase 2 success criteria (`/clear` ≈ 389, etc.).
- [ ] Heatmap shows plausible work-hours pattern; cells sum to total entries.
- [ ] Per-project rows navigate to the correct `/project/[slug]` page.
- [ ] Activity link appears in sidebar, highlights when active.
- [ ] Empty-state renders cleanly when history.jsonl absent.
- [ ] `pnpm lint` and `pnpm build` clean; no new type errors.

## Risk Assessment
- **Recharts horizontal bar label crowding** (40+ commands): cap leaderboard to top ~20, show "+N more" note. No silent truncation.
- **Heatmap contrast in dark mode**: use existing color tokens, verify both themes if app supports them.
- **Slug→project mismatch**: raw-path fallback prevents broken links; verify with a project that has a session dir vs one that doesn't.
- **File-size rule** (CLAUDE.md <200 lines): five small components keep each well under limit; don't merge into one mega-file.
