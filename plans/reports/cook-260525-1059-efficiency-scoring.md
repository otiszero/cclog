# Efficiency Scoring (B+C) — Implementation Report

Brainstorm research: `plans/reports/researcher-260525-1059-token-efficiency-metrics.md`

## Status

DONE. Build + lint green. UI wired session + project level.

## What shipped

### Metrics (3 displayed)
- **Cache hit rate** = `cacheRead / (cacheRead + input + cacheCreate)`. Bad <50%.
- **Re-read waste** = `repeated_Read_calls / total_Read_calls` (grouped by `file_path`). Bad >30%.
- **Tool bloat** = `# tool results ≥10kB / # tool calls`. Bad >20%.

### Anti-pattern detectors
- **Re-grep loop** — same `file_path` Read 3+ times → flag every turn that owns one
- **Tool output explosion** — `resultFull.length ≥ 10000` → flag owner turn

### Score → letter
Weighted: 40 cache + 30 re-read + 30 bloat. A≥90, B≥80, C≥70, D≥60, F<60. `N/A` for sessions <3 turns.
Project score = **token-weighted average** of session scores (sessions burning more tokens dominate).

## Files

**New**
- `src/lib/parser/derive-efficiency.ts` — metric + detector + score + aggregate
- `src/components/session/efficiency-card.tsx` — expandable card + reusable `EfficiencyBadge`

**Modified**
- `src/lib/types.ts` — `EfficiencyReport`, `AntiPatternFinding` types; embedded into `SessionMeta` + `ProjectSummary`
- `src/lib/parser/aggregate-project.ts` — populate per-session + aggregate
- `src/app/project/[slug]/session/[id]/page.tsx` — render `EfficiencyCard`
- `src/app/project/[slug]/page.tsx` — Efficiency KPI + per-session grade column
- `src/components/session/session-tabs.tsx` — pass findings into timeline
- `src/components/session/timeline-waterfall.tsx` — flagged turns get red border + ⚑ tag (tooltip lists findings)

## Caching note

No change to cache layer. `derive-efficiency` runs inside the existing mtime-keyed `aggregate-project` and route-level session cache → metrics are recomputed only when JSONL changes.

## Trade-offs honored

1. Show 3 metrics + 1 letter grade, click "Show findings" to expand list. No mysterious 0-100 surfaced as primary signal (score shown only as sub-label).
2. Project grade = token-weighted (denominator = `sumTokens(totalTokens)` per session).
3. Hardcoded thresholds (cache <50%, re-read >30%, bloat >20%, big-tool ≥10kB, re-grep ≥3). v2 percentile noted in brainstorm.

## Unresolved / future

- No global dashboard surface yet (only per-project + per-session). Add KPI on `/` if user wants.
- Cache Collapse detector (TTL boundary) deferred — needs per-turn timestamp gap analysis.
- Tool bloat denominator only counts tool calls with `resultFull`; some tool_use entries lack a recorded result (parser stores up to 200kB cap). Likely undercount but consistent.
- No tests written — repo has no test framework configured.

**Status:** DONE
**Summary:** Per-session + per-project efficiency report (3 metrics + A-F grade + 2 anti-pattern detectors). Flagged turns highlighted on timeline. Build + lint clean.
