# analysis-cc

Local web UI to explore your Claude Code session logs. Reads `~/.claude/projects/*/*.jsonl`
and surfaces token usage, sub-agents, tools, MCP and skills with charts, timelines, and
full-text prompt search. Everything runs on your machine; nothing is sent anywhere.

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Optional: point at a different Claude config dir.

```bash
CLAUDE_HOME=/path/to/.claude pnpm dev
```

## Views

| Route | Purpose |
|---|---|
| `/` | Global KPIs · 30-day trend · top projects · top tools · model split |
| `/project/[slug]` | Project totals · usage chart · leaderboards (tools, sub-agents, MCP, skills) · session list |
| `/project/[slug]/session/[id]` | Timeline waterfall · per-turn token stacked bars · prompt/response viewer |
| `/search` | Cross-session prompt full-text search (Fuse.js) |

## Architecture

```
src/
├── app/                      # Next.js routes (server components for data, client for charts)
├── components/               # UI: layout, common, session, project, global
└── lib/
    ├── parser/
    │   ├── claude-home.ts            # locate ~/.claude
    │   ├── decode-project-path.ts    # flat-encoded slug → real cwd
    │   ├── scan-projects.ts          # list projects + session files
    │   ├── categorize-tool.ts        # tool name → tool|mcp|skill|sub_agent
    │   ├── parse-session.ts          # stream jsonl → SessionEvent[]
    │   ├── derive-metrics.ts         # totals, leaderboards, turn series
    │   ├── cache.ts                  # mtime-aware in-memory LRU
    │   ├── aggregate-project.ts      # cached project rollup
    │   ├── aggregate-global.ts       # global rollup with 60s TTL
    │   └── build-prompt-index.ts     # Fuse.js index with 5min TTL
    ├── pricing.ts            # static $/MTok table (see PRICING_AS_OF)
    ├── format.ts             # token/cost/duration/relative-time formatters
    └── types.ts              # SessionEvent, ParsedSession, ProjectSummary, …
```

## Caching

- Per-session parse cached by file mtime (LRU 50).
- Per-project aggregate cached by newest session mtime.
- Global aggregate cached 60s.
- Prompt search index cached 5min.

## Pricing

`src/lib/pricing.ts` holds a static `$/MTok` table per model. Snapshot date is in
`PRICING_AS_OF`. Update when Anthropic changes pricing.

Cost numbers are **estimates** — verify against your Anthropic billing console.

## Sub-agent detection

A `tool_use` block named `Task` is treated as a sub-agent spawn. The `subagent_type`
field of its `input` is used as the label in leaderboards.

## MCP / Skill detection

- MCP tool name starts with `mcp__`.
- Skill invocation: tool name `Skill` with `input.skill` carrying the skill name.

## Not implemented (v1, intentionally)

- Real-time tail of running sessions.
- SQLite / DuckDB index.
- Authentication / multi-user.
- CSV/JSON export.
- Pricing auto-update.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts · Fuse.js · react-markdown · Zod · date-fns.

## License

Personal use.
