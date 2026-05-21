# Phase 02 — Parser Library

## Overview
- **Priority:** P0 (core data layer)
- **Status:** pending
- Build server-side modules that turn raw jsonl into normalized events + derived metrics. In-memory cache with mtime invalidation.

## Data shape (from scout)
Entry types: `assistant`, `user`, `system`, `attachment`, `permission-mode`, `last-prompt`, `file-history-snapshot`, `queue-operation`.
`assistant.message`: `{ model, usage: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, service_tier }, content: [...] }`.
`content[]` blocks: `text`, `tool_use {name, input, id}`, `tool_result {tool_use_id, content}`, `thinking`.
Every entry has `timestamp` (ISO) + `uuid` + optional `parentUuid`.

## Modules
### `src/lib/parser/scan-projects.ts`
- `listProjects(): ProjectDir[]` — read `~/.claude/projects/` (env override `CLAUDE_HOME`).
- Decode flat dir name `-Users-trung-hoang-Desktop-foo` → real cwd path heuristic (replace `-` with `/`, anchor at `/`).
- Returns `{slug, realPath, sessionCount, lastModified}`.

### `src/lib/parser/parse-session.ts`
- `parseSession(filePath): ParsedSession` — stream-read jsonl line-by-line (Node `readline`), JSON.parse per line, push into normalized `SessionEvent[]`.
- Defensive: try/catch per line, skip + count malformed.
- Extract tool_use/tool_result pairs (link by `tool_use_id`), attach to parent assistant turn.
- Detect sub-agents: `tool_use.name === "Task"` → child session uuid (from input.subagent_type or response).

### `src/lib/parser/derive-metrics.ts`
Pure functions on `SessionEvent[]`:
- `totalTokens(events)` → `{input, output, cacheRead, cacheCreate, total}`.
- `tokensByTurn(events)` → array per assistant turn.
- `tokensByTool(events)` → group by tool name.
- `tokensBySubAgent(events)` → group by sub-agent type.
- `latencyByTurn(events)` → diff timestamps.
- `modelBreakdown(events)` → tokens per model id.

### `src/lib/parser/cache.ts`
- `Map<filePath, {mtime, parsed}>`.
- `getParsed(filePath)`: stat → if mtime changed, re-parse; else return cached.
- LRU cap: 50 sessions.

## Types (`src/lib/types.ts`)
```ts
type SessionEvent =
  | { kind: "turn"; ts: string; uuid: string; model: string; usage: TokenUsage; text?: string }
  | { kind: "user_prompt"; ts: string; uuid: string; text: string }
  | { kind: "tool_use"; ts: string; uuid: string; parentTurn: string; name: string; input: unknown; resultId?: string }
  | { kind: "tool_result"; ts: string; toolUseId: string; ok: boolean; preview: string }
  | { kind: "sub_agent"; ts: string; parentTurn: string; type: string; childSessionId?: string }
  | { kind: "system"; ts: string; subtype: string };

type TokenUsage = { input: number; output: number; cacheRead: number; cacheCreate: number };
type ParsedSession = { sessionId: string; filePath: string; events: SessionEvent[]; skippedLines: number };
```

## Files
- `src/lib/parser/scan-projects.ts`
- `src/lib/parser/parse-session.ts`
- `src/lib/parser/derive-metrics.ts`
- `src/lib/parser/cache.ts`
- `src/lib/parser/decode-project-path.ts`
- `src/lib/types.ts` (filled in)
- `src/lib/parser/__tests__/parse-session.test.ts` (optional unit test with fixture)

## Success
- Parse a real ~5MB jsonl in <500ms.
- `totalTokens` output matches `jq -s '[.[] | .message.usage.input_tokens // 0] | add'`.
- Cache hit on second call (no file read).

## Risks
1. **Schema drift** — defensive try/catch, log skipped count, never throw.
2. **Tool_use ↔ tool_result linkage** — sometimes async; match by id, leave unlinked if missing.
3. **Project dir decoding** — flat-name → real path may be ambiguous (dashes in real names). Store both decoded + raw.

## Todo
- [ ] `scan-projects.ts`
- [ ] `decode-project-path.ts`
- [ ] `parse-session.ts` (streaming)
- [ ] `derive-metrics.ts`
- [ ] `cache.ts` with mtime + LRU
- [ ] types finalized
- [ ] sanity test against real jsonl
