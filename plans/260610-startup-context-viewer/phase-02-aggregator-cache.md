---
phase: 2
title: Aggregator & Cache
status: completed
priority: P1
effort: 2h
dependencies:
  - 1
---

# Phase 2: Aggregator & Cache

## Overview
Assemble `InjectedSource[]` into a per-project `StartupContext` and a cross-project
`StartupContextSummary`, both cached. Caching keyed on the newest mtime among the contributing
files so edits to CLAUDE.md/rules/memory invalidate correctly.

## Requirements
- Functional: `aggregateStartupContext(slug, realPath)` → `StartupContext`;
  `aggregateContextSummary(projects)` → `StartupContextSummary` for the `/context` route.
- Non-functional: cache both; the shared global block is computed once and reused across every
  project (it's identical) — don't re-read rules/*.md per project.

## Architecture
Two cached layers (mirrors `aggregate-global.ts` module-level pattern):

1. **Shared global block** — `collectGlobalSources()` result + its newest mtime. Cached module-level;
   recomputed only when any `~/.claude/CLAUDE.md` / `rules/*.md` / `memory/*.md` mtime changes.
2. **Per-project** — `Map<slug, { mtimeMs, at, data }>` TTL+mtime cache. `mtimeMs` = max mtime of
   shared block + project files. Assembles `StartupContext`:
   - `sources` = shared sources + project sources
   - `sharedTokens` = Σ global-* tokens; `projectTokens` = Σ project-* tokens; `totalTokens` = both
   - `byCategory` = group + sum tokens/file-count per category

`aggregateContextSummary(projects)`: compute shared block once, then for each project read only its
project-specific sources (cheap) → `{ slug, realPath, totalTokens: shared+project, projectTokens }`.
Takes the project list from `listProjects()` (scan-projects.ts) — caller passes it or aggregator calls it.

Cache strategy: TTL_MS = 60_000 backstop + mtime check (same hybrid as aggregate-activity.ts).
Helper to compute newest mtime: `statSync(path).mtimeMs` over contributing files, max; missing → skip.

## Related Code Files
- Create: `src/lib/parser/aggregate-startup-context.ts`
- Read for context: `src/lib/parser/aggregate-global.ts` (cache pattern), `src/lib/parser/aggregate-activity.ts` (mtime+TTL hybrid), `src/lib/parser/scan-projects.ts` (listProjects), `src/lib/parser/collect-injected-files.ts` (Phase 1)

## Implementation Steps
1. Create `aggregate-startup-context.ts`.
2. Module-level shared-block cache: `{ mtimeMs, sources }`; `getSharedSources()` recomputes on mtime change.
3. `export async function aggregateStartupContext(slug, realPath): Promise<StartupContext>`:
   - shared = `getSharedSources()`; project = `collectProjectSources(realPath, slug)`.
   - mtime = max(shared mtime, project files mtime); serve cache if unchanged + within TTL.
   - assemble totals + `byCategory` + shared/project token split.
4. `export async function aggregateContextSummary(): Promise<StartupContextSummary>`:
   - shared once; iterate `listProjects()`; per project read project sources only.
   - cache module-level with TTL (list is moderately sized; reading 2 small files/project is cheap).
5. `clearStartupContextCache()` for tests/debug (parity with other caches).

## Success Criteria
- [ ] `aggregateStartupContext(cclogSlug, cclogPath)` → `totalTokens ≈ 12.7k`, `sharedTokens ≈ 12k`, `projectTokens ≈ 0.76k`.
- [ ] `byCategory` sums equal `totalTokens`; categories with no files are omitted (or zero-count, consistent with UI expectation).
- [ ] `aggregateContextSummary()` returns one row per project; all share the same `sharedTokens`.
- [ ] Editing `~/.claude/CLAUDE.md` (touch) invalidates the shared block on next call (mtime check).
- [ ] Second call within TTL + unchanged mtime does not re-read disk (verify with temp counter, then remove).
- [ ] `pnpm build` clean.

## Risk Assessment
- **Shared-block staleness across projects**: keyed on global files' mtimes; touching any rules file busts it. Low risk.
- **`/context` cost with many projects**: 89 projects × 2 small reads = cheap; shared block read once. If it grows, add the same per-project mtime cache. Acceptable now.
- **Token double-count**: ensure shared sources are added once per `StartupContext`, not per category iteration. Unit-check totals against manual `wc`.
