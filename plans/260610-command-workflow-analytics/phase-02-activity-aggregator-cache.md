---
phase: 2
title: Activity Aggregator & Cache
status: completed
priority: P1
effort: 2h
dependencies:
  - 1
---

# Phase 2: Activity Aggregator & Cache

## Overview
Roll up `HistoryEntry[]` into a single cached `ActivityStats` object the route renders. Self-contained
cache mirrors `aggregate-global.ts` (module-level), keyed on `history.jsonl` mtime so a growing log
invalidates correctly.

## Requirements
- Functional: produce `commandLeaderboard`, 7×24 `heatmap`, `perProject` mix, `clearCadence`, totals, `dateRange`.
- Non-functional: cache the rollup; second call within TTL + same mtime returns memoized result (no re-parse).

## Architecture
Data flow: `parseHistory()` → in-memory reduction → `ActivityStats` → module cache.

Cache strategy (hybrid mtime + TTL, stricter than global's pure-TTL):
```ts
let cached: { mtimeMs: number; at: number; data: ActivityStats } | null = null;
const TTL_MS = 60_000;
// reuse if cached && mtime unchanged && within TTL
```
Why both: mtime catches new prompts immediately on a fresh load; TTL bounds staleness if mtime stat fails.
If `history.jsonl` missing → return a zeroed `ActivityStats` (don't throw).

Reductions (single pass over entries):
- **leaderboard**: `Map<command, {count, namespace}>` → sort desc → array. Prompts excluded.
- **heatmap**: `number[][]` 7×24, zero-init; bucket each entry by `getDay()`/`getHours()` (local time via `date-fns` or native Date — match app convention in `format.ts`).
- **perProject**: `Map<slug, {path, total, cmdCounts}>` → derive `topCommand` per project → sort by total desc. Cap list at top ~30 (log if truncated — no silent cap).
- **clearCadence**: count `/clear`; `avgEntriesBetweenClears = totalEntries / max(clears, 1)`.
- **totals / dateRange**: counts + min/max ts.

## Related Code Files
- Create: `src/lib/parser/aggregate-activity.ts`
- Read for context: `src/lib/parser/aggregate-global.ts` (TTL cache pattern), `src/lib/format.ts` (date/number formatters), `src/lib/parser/parse-history.ts` (Phase 1)
- Modify: none (types already added in Phase 1)

## Implementation Steps
1. Create `aggregate-activity.ts` exporting `export async function aggregateActivity(): Promise<ActivityStats>`.
2. Implement the hybrid cache guard (stat `historyFile()` for mtime; compare against `cached`).
3. On miss: `parseHistory()` → single reduction pass building the structures above → assemble `ActivityStats` (carry `skipped` through).
4. Store in module cache with `{ mtimeMs, at: Date.now(), data }`.
5. Export a `clearActivityCache()` for parity with `cache.ts` (tests/debug).
6. Handle empty/missing file → zeroed stats with `dateRange {from:0,to:0}`.

## Success Criteria
- [ ] `aggregateActivity()` leaderboard top row is `/clear` with count ≈ 389 (reconciles with `grep`).
- [ ] `heatmap` is 7×24; sum of all cells == `totalEntries`.
- [ ] `perProject` includes cclog slug, links resolvable later; truncation (if any) logged.
- [ ] `clearCadence.clears` ≈ 389; `avgEntriesBetweenClears` sane (>0).
- [ ] Second call with unchanged file does not re-parse (verify via a temporary log/counter, then remove).
- [ ] Missing file → zeroed stats, no throw.
- [ ] `pnpm build` clean.

## Risk Assessment
- **Stale cache on append**: mtime check covers it; TTL is the backstop. Low risk.
- **Local-time correctness**: use the same time source as the rest of the app to keep heatmap consistent with session views.
- **Large `perProject`** (89 projects): capping to top ~30 keeps UI tidy; emit `log` note when truncating so coverage isn't silently hidden.
