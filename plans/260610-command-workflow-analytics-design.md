# Command & Workflow Analytics — Design

**Date:** 2026-06-10
**Status:** brainstorm complete, pending plan
**Owner feature:** new `/activity` route powered by `~/.claude/history.jsonl`

## Problem statement

cclog visualizes token/cost/session metrics from JSONL *session* logs, but never touches
`history.jsonl` — the 4,877-row append-only log of every prompt + slash command the user
typed. This is the only source of **behavioral / workflow** data (what commands you lean on,
when you work, how often you `/clear`). Zero current coverage. Cheapest rich source available.

## Data model (verified)

One JSON object per line in `~/.claude/history.jsonl`:

```jsonc
{
  "display": "/ck:cook" | "spin up this project ...",  // slash cmd OR plain prompt
  "pastedContents": {} | { "1": { "id", "type", "content" } },
  "timestamp": 1781065663615,            // epoch ms
  "project": "/Users/trung.hoang/Desktop/cclog",  // FULL cwd path, not slug
  "sessionId": "43202b02-..."
}
```

Verified facts:
- 4,877 rows; 89 distinct projects; 0 blank displays; sessionId always present.
- 3,144 plain prompts vs ~1,733 slash commands.
- `project` is full path → must encode path→slug (inverse of `decode-project-path.ts`)
  to deep-link into existing `/project/[slug]`.
- Top commands today: `/clear` ×389, `/ck:cook` ×136, `/ck:ask` ×107, `/ck:git` ×103,
  `/model` ×101, `/ck:fix` ×84, `/ck:plan` ×55.

### Entry classification (derive layer)
- `kind`: `"command"` if `display` starts with `/`, else `"prompt"`.
- `command`: first token of display when kind=command (e.g. `/ck:cook`). Namespace = part
  before `:` (`ck`, builtin = none).
- `hasPaste`: `Object.keys(pastedContents).length > 0`.
- `promptChars`: `display.length` (+ paste content length) — proxy for prompt verbosity.

## Approaches considered

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A. New parser module + cached aggregator + `/activity` route** | Matches existing arch (parser→aggregate→cache→server comp→client chart); isolated; reuses `format.ts`, slug encoder | One new route + ~3 files | ✅ Chosen |
| B. Fold into existing `/` home dashboard | No new route | Home already dense; history is a different *axis* (behavior vs tokens); crowds KPIs | ✗ |
| C. Client-side parse in browser | No server parser | Breaks "server does data" convention; 4877 rows over wire; no cache | ✗ |

## Chosen solution (A)

### New files
- `src/lib/parser/parse-history.ts` — stream-read `history.jsonl`, classify each row into
  typed `HistoryEntry`. Mirrors `parse-session.ts` streaming style.
- `src/lib/parser/aggregate-activity.ts` — roll up entries into `ActivityStats`
  (totals, command leaderboard, hourly×weekday heatmap matrix, per-project mix,
  clear-cadence). Cached via existing `cache.ts` (mtime-keyed on history.jsonl, TTL like global 60s).
- `src/app/activity/page.tsx` — server component → calls cached aggregator.
- `src/components/activity/*` — client chart components.

### Types added to `lib/types.ts` (contract first)
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
  dateRange: { from: number; to: number };
  commandLeaderboard: { command: string; count: number; namespace?: string }[];
  heatmap: number[][];              // [7 weekdays][24 hours] counts
  perProject: { slug: string; path: string; total: number; topCommand?: string }[];
  clearCadence: { clears: number; avgEntriesBetweenClears: number };
};
```

### UI (route `/activity`)
1. **KPI strip** — total prompts, total commands, distinct projects, date span (reuse format.ts).
2. **Command leaderboard** — horizontal bar (Recharts), grouped/colored by namespace
   (`ck`, builtin). Click → filter.
3. **Activity heatmap** — 7×24 grid (weekday × hour-of-day), color by count. Pure CSS grid,
   no chart lib needed (KISS).
4. **Per-project mix** — table: project (links to `/project/[slug]`), entry count, top command.
5. **Context-reset cadence** — `/clear` count + avg entries between clears (a "how often you
   reset context" signal).

### Caching
- Add `aggregate-activity` to `cache.ts` keyed on `history.jsonl` mtime (LRU or 60s TTL,
  same pattern as `aggregate-global`). Route never calls parser directly.

### Nav
- Add `/activity` link to existing top-nav alongside `/`, `/projects`, `/search`.

## Edge cases / risks
- **Malformed lines** — wrap per-line `JSON.parse` in try/catch, skip + count skipped (like session parser tolerance).
- **Path→slug encoding** — Claude flat-encodes `/`→`-`; verify against an existing slug dir to
  avoid mismatch (dots in `.claude` etc.). Fallback: show path if slug not found in scan-projects.
- **Timezone** — heatmap uses local time via `date-fns` (consistent w/ rest of app).
- **File size growth** — 1.2 MB now; streaming read keeps memory flat. No pagination needed.
- **pastedContents** — not rendered in v1 (privacy + noise); only counted via `hasPaste`.

## Out of scope (this round)
- Prompt full-text search over history (already have `/search` on session prompts).
- Telemetry/model timeline, jobs dashboard, plans tracker, file-churn (separate features).
- Rendering pasted content.

## Success criteria
- `/activity` renders leaderboard + heatmap + per-project + clear-cadence from real history.jsonl.
- Numbers reconcile with raw `grep` counts (e.g. `/clear` ≈ 389).
- Cached: second load hits cache, no re-parse (verify via mtime key).
- `pnpm build` clean; no new type errors; types added to `lib/types.ts` first.

## Next step
Hand to `/ck:plan` (default mode — additive new feature, no existing-behavior refactor).
