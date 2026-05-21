# Brainstorm Report — cclog

**Date:** 2026-05-21
**Output path:** `~/Desktop/cclog/`
**Status:** Design approved → proceed to /ck:plan

## Problem
User muốn local tool đọc logs Claude Code (`~/.claude/projects/*.jsonl`) → UI dễ đọc để phân tích session/prompt quá khứ. Cần thấy token cost tới từ đâu (sub-agent, tool call, MCP, skill, prompt), timeline, latency. Không bịa số — mọi metric base từ jsonl.

## Data source (đã scout)
- Path: `~/.claude/projects/<flat-encoded-cwd>/<session-uuid>.jsonl`
- Entry types: `assistant` (có `message.usage`: input/output/cache_creation/cache_read tokens, model, service_tier), `user`, `system`, `attachment`, `permission-mode`, `last-prompt`, `file-history-snapshot`, `queue-operation`.
- Tool calls: nằm trong `assistant.message.content[]` blocks (`tool_use` / `tool_result`).
- Timestamps trên mọi entry → derive latency.
- Sub-agent: detect qua `Task` tool_use → spawned session uuid chain (parent/child).

## Approaches evaluated

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| Next.js local web | Full UI, server-side fs access, dev fast | Heavier than SPA | ✅ Chosen |
| Vite SPA + Node API | Lighter | Tự wire routing/data | ❌ |
| Static + pre-parsed JSON | No runtime server | Re-run parser mỗi lần | ❌ |
| TUI | Native terminal | Charts/timeline khó | ❌ |

Data layer: **on-demand parse + in-memory cache** (KISS). Không SQLite/DuckDB cho v1.

## Final solution

**Stack:** Next.js 15 App Router + TS + Tailwind + shadcn/ui + Recharts + Fuse.js.

**Modules:**
- `src/lib/parser/scan-projects.ts` — list & decode project dirs.
- `src/lib/parser/parse-session.ts` — stream jsonl → normalized `SessionEvent[]`.
- `src/lib/parser/derive-metrics.ts` — events → metrics (tokens by turn/tool/sub-agent, latency, cost).
- `src/lib/pricing.ts` — static model→$/MTok map + disclaimer banner.
- Cache: `Map<sessionId, ParsedSession>` + mtime invalidation.

**Routes:**
- `/` — global dashboard (tổng tokens/cost theo project, time-series 30d, top models).
- `/project/[slug]` — session list + aggregate + leaderboard (tool/MCP/skill/sub-agent).
- `/project/[slug]/session/[id]` — timeline waterfall, token stacked bars per turn, prompt/response viewer.
- `/search` — cross-session prompt full-text search.

**Out of scope (YAGNI):** real-time tail (chokidar), DB layer, auth, multi-user, export CSV.

## Risks & mitigations
1. **jsonl schema drift** → defensive parser, try/catch per line, skip unknown types, log skipped count.
2. **Large sessions (>50MB)** → stream parse line-by-line; list view dùng metadata-only pass.
3. **Sub-agent uuid chain mất** → fallback flat list.
4. **Pricing outdated** → static table + dated disclaimer banner.

## Success metrics
- Mở 1 session 100MB jsonl render trong <3s.
- Token số liệu khớp manual `jq` aggregate.
- Sub-agent tree hiển thị đúng parent/child cho session có Task tool calls.

## Open questions
- Export (CSV/JSON)? — default **no**.
- Dark mode? — default **yes** (shadcn free).
- Pricing snapshot date? — dùng 2026-05-21 làm "as-of".

## Next
Invoke `/ck:plan` với context này → phase breakdown (scaffold, parser, metrics, dashboard, session view, search).
