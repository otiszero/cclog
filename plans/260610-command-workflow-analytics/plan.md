---
title: Command & Workflow Analytics (/activity route)
description: ''
status: completed
priority: P2
branch: main
tags: []
blockedBy: []
blocks: []
created: '2026-06-10T04:31:55.185Z'
createdBy: 'ck:plan'
source: skill
---

# Command & Workflow Analytics (/activity route)

## Overview

New `/activity` route surfacing **behavioral/workflow analytics** from `~/.claude/history.jsonl`
(4,877 rows of every prompt + slash command). The only behavioral data source in the app — current
views cover tokens/cost/sessions, none touch command-usage habits. Fully additive: no existing
route, parser, or type is modified destructively.

Design source: [`../260610-command-workflow-analytics-design.md`](../260610-command-workflow-analytics-design.md)

Delivers: command leaderboard, 7×24 activity heatmap (weekday × hour), per-project command mix
(deep-links to `/project/[slug]`), and `/clear` context-reset cadence.

**Architecture** (mirrors existing `parser → aggregate → cache → server component → client chart`):
- `parse-history.ts` streams + classifies rows → `HistoryEntry[]`
- `aggregate-activity.ts` rolls up → `ActivityStats`, self-contained mtime+TTL cache (same pattern as `aggregate-global.ts`)
- `/activity` server component → client chart components under `components/activity/`

**Key simplifications discovered during planning:**
- Path→slug is trivial `path.replaceAll('/', '-')` (verified against real project dirs) — no need for the `decode-project-path.ts` heuristic.
- Caching follows `aggregate-global.ts`'s module-level TTL pattern, **not** `cache.ts` (which only handles per-session parse).
- Heatmap is a pure CSS grid — no extra chart lib.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Types & History Parser](./phase-01-types-history-parser.md) | Completed |
| 2 | [Activity Aggregator & Cache](./phase-02-activity-aggregator-cache.md) | Completed |
| 3 | [Route](./phase-03-route.md) | Completed |
| 4 | [UI & Nav](./phase-04-ui-nav.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
