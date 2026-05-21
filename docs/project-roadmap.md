# Project Roadmap

## Phase 1 — v1 reader (✅ shipped)
- Scan `~/.claude/projects/*`, parse JSONL sessions
- Global / project / session views with cached aggregates
- Timeline waterfall, per-turn token stacked chart
- Cross-session prompt full-text search (Fuse.js)
- Tool / MCP / Skill / Sub-agent leaderboards

## Phase 1.1 — Timeline readability (✅ 2026-05)
- Split `timeline-waterfall.tsx` into legend + token-bar + waterfall
- Two-bar token visualization (ctx + work) to fix cacheRead-dominance issue
- Inline SVG icons, tooltips, sub-agent name display, delta timestamps
- Expand panel surfaces tool result previews via `parentTurn` join

## Phase 2 — candidate enhancements (not committed)
Each item is opt-in, not assumed:
- [ ] Date range filter on `/project/[slug]` (currently full lifetime)
- [ ] Per-tool cost breakdown (input vs output split per tool)
- [ ] Sticky session header on long sessions
- [ ] Virtualized timeline list (only matters above ~500 turns)
- [ ] Compare two sessions side-by-side
- [ ] Highlight prompts in `/search` results with surrounding context

## Explicitly NOT planned (v1 non-goals stand)
- Real-time tail of running sessions
- SQLite / DuckDB index
- Auth / multi-user / remote deployment
- CSV / JSON export
- Pricing auto-update from Anthropic

## How to propose new work
1. Open `plans/{YYMMDD-HHMM}-{slug}/plan.md` with phase files
2. Verify the metric belongs in `derive-metrics.ts` (so cache covers it)
3. Update `codebase-summary.md` + this roadmap when shipped
