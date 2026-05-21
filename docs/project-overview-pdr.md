# Project Overview — cclog

## What
Local web UI to explore Claude Code session logs (`~/.claude/projects/*/*.jsonl`).

## Why
Claude Code writes rich JSONL telemetry per session (tokens, tool calls, sub-agents, prompts) but exposes no built-in way to slice, aggregate, or search across sessions. cclog is a zero-dependency-on-cloud, mtime-cached reader for that data.

## Non-goals (intentional, v1)
- No real-time tail of running sessions
- No SQL/DuckDB index (filesystem + LRU cache is enough at current scale)
- No auth, no multi-user, no remote access
- No CSV/JSON export
- No pricing auto-update (static table, snapshot date in `PRICING_AS_OF`)

## Users
Single developer running on their own machine. UI assumes the viewer wrote the prompts being shown.

## Privacy
Nothing leaves the machine. No telemetry. No API to external services.

## Success criteria
- Open any session → understand at a glance what happened (tokens, tools, sub-agents, prompt/response)
- Cross-session prompt search returns hits in <1s on a normal session set
- New metrics can be added by editing only `derive-metrics.ts` (cache layer handles invalidation)
