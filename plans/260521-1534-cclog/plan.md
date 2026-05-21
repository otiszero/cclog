---
name: cclog
status: completed
created: 2026-05-21
completed: 2026-05-21
slug: cclog
output: ~/Desktop/cclog/
blockedBy: []
blocks: []
---

# Plan: cclog

Local Next.js web app to analyze Claude Code session logs (`~/.claude/projects/*.jsonl`). Surfaces token usage, sub-agent/tool/MCP/skill costs, timelines, prompt history. No fabricated numbers — everything derived from jsonl.

**Brainstorm:** [/Users/trung.hoang/.claude/plans/reports/brainstorm-260521-1534-cclog.md](../reports/brainstorm-260521-1534-cclog.md)

## Stack
Next.js 15 (App Router, TS) · Tailwind · shadcn/ui · Recharts · Fuse.js · Zod.

## Phases

| # | Phase | Status | Depends |
|---|---|---|---|
| 01 | Scaffold project + tooling | done | — |
| 02 | Parser library (scan/parse/derive) | done | 01 |
| 03 | Pricing table + cost calc | done | 02 |
| 04 | Session view (timeline + tokens + prompts) | done | 02, 03 |
| 05 | Project page + leaderboard | done | 02, 03 |
| 06 | Global dashboard | done | 02, 03 |
| 07 | Cross-session prompt search | done | 02 |
| 08 | Polish: dark mode, errors, docs | done | 04-07 |

## Key Dependencies
- Read-only access to `~/.claude/projects/` (filesystem).
- Node ≥ 20 for native fetch + structured clone.
- shadcn CLI for component scaffolding.

## Success Criteria
- Open session 100MB jsonl renders <3s.
- Token aggregates match manual `jq` sums.
- Sub-agent tree renders correctly when Task tool calls present.
- All 4 views functional (dashboard / project / session / search).

## Out of Scope (v1)
Real-time tail, SQLite/DuckDB indexing, auth/multi-user, export (CSV/JSON), pricing auto-update.
