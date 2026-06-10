---
phase: 1
title: Types & History Parser
status: completed
priority: P1
effort: 2h
dependencies: []
---

# Phase 1: Types & History Parser

## Overview
Establish the parser→UI contract (types-first) and a streaming reader that turns each
`history.jsonl` line into a typed `HistoryEntry`. Foundation for the aggregator (Phase 2).

## Requirements
- Functional: read `~/.claude/history.jsonl`, classify each row as `command` | `prompt`, derive
  command + namespace, project slug, paste flag, char count.
- Non-functional: stream line-by-line (file is ~1.2 MB, append-only, will grow); tolerate malformed
  lines (skip + count); reuse `claude-home.ts` for path resolution.

## Architecture
Data flow: `history.jsonl` → `parseHistory()` → `HistoryEntry[]` (consumed by Phase 2 aggregator).

Verified row shape:
```jsonc
{ "display": "/ck:cook" | "free text", "pastedContents": {} | {"1": {...}},
  "timestamp": 1781065663615, "project": "/Users/trung.hoang/Desktop/cclog",
  "sessionId": "43202b02-..." }
```

Classification rules (derive layer):
- `kind` = `display.startsWith("/") ? "command" : "prompt"`.
- `command` = first whitespace-delimited token when `kind==="command"` (e.g. `/ck:cook`).
- `namespace` = substring between leading `/` and `:` if present (`ck`); else `undefined` (builtin like `/clear`, `/model`).
- `projectSlug` = `project.replaceAll("/", "-")` — verified inverse of the flat-encoded dirs
  (e.g. `/Users/trung.hoang/Desktop/cclog` → `-Users-trung-hoang-Desktop-cclog`). Do NOT use the
  `decode-project-path.ts` heuristic; encoding is exact and trivial.
- `hasPaste` = `Object.keys(pastedContents ?? {}).length > 0`.
- `promptChars` = `display.length` + summed paste `content.length`.

## Related Code Files
- Create: `src/lib/parser/parse-history.ts`
- Create: `src/lib/parser/encode-project-path.ts` (single `encodeProjectSlug(path): string` helper — `replaceAll("/", "-")`; documented as exact inverse of `decode-project-path.ts`)
- Modify: `src/lib/types.ts` (add `HistoryEntryKind`, `HistoryEntry`, `ActivityStats` — contract for Phase 2/3/4)
- Read for context: `src/lib/parser/parse-session.ts` (streaming style), `src/lib/parser/claude-home.ts`, `src/lib/parser/decode-project-path.ts`

## Implementation Steps
1. Add to `src/lib/types.ts` (types-first, before any consumer):
   ```ts
   export type HistoryEntryKind = "command" | "prompt";
   export type HistoryEntry = {
     ts: number; kind: HistoryEntryKind; display: string;
     command?: string; namespace?: string;
     projectPath: string; projectSlug: string;
     sessionId: string; hasPaste: boolean; promptChars: number;
   };
   export type ActivityStats = {
     totalEntries: number; commandCount: number; promptCount: number;
     skipped: number;
     dateRange: { from: number; to: number };
     commandLeaderboard: { command: string; count: number; namespace?: string }[];
     heatmap: number[][];   // [7 weekdays 0=Sun][24 hours] counts
     perProject: { slug: string; path: string; total: number; topCommand?: string }[];
     clearCadence: { clears: number; avgEntriesBetweenClears: number };
   };
   ```
2. Add `historyFile()` helper to `claude-home.ts` returning `join(claudeHome(), "history.jsonl")` (mirrors `projectsDir()`).
3. Create `encode-project-path.ts` with `encodeProjectSlug(path: string): string` → `path.replaceAll("/", "-")`.
4. Create `parse-history.ts`:
   - `export async function parseHistory(): Promise<HistoryEntry[]>`.
   - Stream the file (Node `readline` over `createReadStream`, like `parse-session.ts`); if absent, return `[]`.
   - Per line: `JSON.parse` in try/catch — on error, skip (caller tallies skipped via array-length diff or a returned counter). Keep it simple: parseHistory returns entries only; track skipped at aggregator level by counting non-empty lines vs parsed length, OR have parseHistory accept and return `{ entries, skipped }`. Choose `{ entries, skipped }` to keep skip count exact.
   - Map each parsed row → `HistoryEntry` via the classification rules above.
5. No caching here — raw parse only. Caching lives in Phase 2.

## Success Criteria
- [ ] `parseHistory()` returns ~4,877 entries from real `history.jsonl` (count reconciles with `wc -l`).
- [ ] Command/prompt split ≈ 1,733 / 3,144 (reconciles with `grep` counts).
- [ ] `/clear` appears as `command` with `namespace: undefined`; `/ck:cook` with `namespace: "ck"`.
- [ ] `projectSlug` for cclog rows equals `-Users-trung-hoang-Desktop-cclog`.
- [ ] Malformed line is skipped, not thrown; skip count surfaced.
- [ ] `pnpm build` type-checks (types added before consumers).

## Risk Assessment
- **Slug mismatch on dotfiles** (e.g. `/Users/x/.claude`): `replaceAll` yields `-Users-x--claude` (double dash) — verified this matches the real dir, so OK. Mitigation: Phase 3/4 fall back to showing path if no matching slug in `scan-projects`.
- **File growth**: streaming keeps memory flat; no pagination needed at current scale.
- **Timezone**: raw parser stores epoch ms only; local-time bucketing deferred to aggregator.
