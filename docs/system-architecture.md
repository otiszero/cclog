# System Architecture

## Process model
Single Next.js 16 process. App Router. No background workers, no DB, no external services.

## Data flow

```
~/.claude/projects/<slug>/*.jsonl
        │
        ▼
parse-session.ts          (stream JSONL → SessionEvent[])
        │
        ▼
derive-metrics.ts         (totals, leaderboards, turn series)
        │
        ▼
cache.ts                  (mtime-keyed LRU — load-bearing)
        │
        ▼
Server Component (route)  ──▶ Client Component (charts/interactivity)
```

## Caching layers (all in `lib/parser/cache.ts` + aggregate-*)
| Layer | Key | Eviction |
|---|---|---|
| Per-session parse | file mtime | LRU 50 |
| Per-project rollup | newest session mtime | LRU 50 |
| Global rollup | clock | 60s TTL |
| Prompt search index (Fuse.js) | clock | 5min TTL |

**Rule:** routes call cached aggregators, never `parse-session` directly. New metrics → add to `derive-metrics.ts` so they inherit the cache.

## Event model (`lib/types.ts`)
`SessionEvent` is a discriminated union over `kind`:
- `user_prompt` — user message text
- `turn` — assistant response: model, `TokenUsage`, text, `ToolUseRef[]`, `durationMs`
- `tool_use` — single tool invocation linked to parent turn (carries `resultPreview`/`resultOk`)
- `sub_agent` — Task tool spawn; linked to parent turn via `parentTurn`
- `system` — control events

## Tool taxonomy (`lib/parser/categorize-tool.ts`)
Closed set of 4 categories — adding a new bucket means updating the union in `lib/types.ts`, the categorizer, AND every leaderboard consumer.

| Category | Detection rule | Label source |
|---|---|---|
| `mcp` | name starts with `mcp__` | `mcp__<server>__<tool>` → `MCP: server/tool` |
| `skill` | name `=== "Skill"` | `input.skill` |
| `sub_agent` | name `=== "Task"` | `input.subagent_type` |
| `tool` | everything else | name as-is |

## Project slug encoding
Claude flat-encodes cwd (slashes → dashes) into the project dir name. `decode-project-path.ts` reverses this — **never hand-roll the decode**.

## Pricing
`lib/pricing.ts` — static `$/MTok` table with `PRICING_AS_OF` snapshot date. Cost numbers everywhere are estimates.

## Routes
| Route | Server fetch | Client interactivity |
|---|---|---|
| `/` | `aggregate-global` | trend chart, model split |
| `/project/[slug]` | `aggregate-project` | usage chart, leaderboards |
| `/project/[slug]/session/[id]` | `getParsedSession` | timeline tabs, expand rows, prompt viewer |
| `/search` | `build-prompt-index` | Fuse.js client search |

## Session detail (timeline tab)
Composition:
- `timeline-legend.tsx` — collapsible explainer for rows/bars/tags
- `timeline-token-bar.tsx` — two stacked bars per turn:
  - **ctx** — total mix (input/output/cacheRead/cacheCreate), grows with session length
  - **work** — `output + cacheCreate` only, the signal for "this turn did real work"
- `timeline-waterfall.tsx` — orchestrates rows; joins `tool_use` events into turn rows via `parentTurn` for expand-panel details
