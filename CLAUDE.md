# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Next.js dev server on http://localhost:3000
- `pnpm build` — production build (run after non-trivial changes; tsbuildinfo is committed)
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`, extends `next`)
- `pnpm start` — serve production build
- `CLAUDE_HOME=/path pnpm dev` — point at a non-default Claude config dir

No test framework is configured.

## Architecture

Single-process Next.js 16 App Router app. Server components read JSONL session logs from `~/.claude/projects/*/*.jsonl` directly off the filesystem; client components render charts. Nothing leaves the machine — no DB, no auth, no API to external services.

**Data flow:** route (server component) → `lib/parser/aggregate-*` → `parse-session` (streams JSONL) → `derive-metrics` → typed object → client chart component.

**Caching is load-bearing.** All aggregation goes through `lib/parser/cache.ts` (mtime-keyed LRU). Routes call cached aggregators, never `parse-session` directly:
- per-session parse: cached by file mtime (LRU 50)
- per-project rollup: cached by newest session mtime (`aggregate-project.ts`)
- global rollup: 60s TTL (`aggregate-global.ts`)
- prompt search index: 5min TTL (`build-prompt-index.ts`, Fuse.js)

When adding a new metric, derive it inside `derive-metrics.ts` so it's covered by the existing cache layer.

**Tool taxonomy** (`categorize-tool.ts`) — every `tool_use` is bucketed into one of four kinds, and leaderboards key off this:
- `mcp` — name starts with `mcp__`
- `skill` — name is `Skill`, label comes from `input.skill`
- `sub_agent` — name is `Task`, label comes from `input.subagent_type`
- `tool` — everything else

Treat these as a closed set; adding a new bucket means updating the union in `lib/types.ts`, the categorizer, and every leaderboard consumer.

**Project slugs** are Claude's flat-encoded cwd (slashes → dashes). `decode-project-path.ts` reverses this — never hand-roll the decode.

**Pricing** (`lib/pricing.ts`) is a static `$/MTok` table with a `PRICING_AS_OF` snapshot date. Cost numbers are estimates; update the table when Anthropic changes pricing rather than computing on the fly.

## Routes

- `/` — global KPIs, 30-day trend, top projects/tools, model split
- `/project/[slug]` — project totals, leaderboards, session list
- `/project/[slug]/session/[id]` — timeline waterfall, per-turn token bars, prompt/response viewer
- `/search` — cross-session prompt full-text search

## Conventions

- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Recharts, Fuse.js, Zod, date-fns
- Server components do data; client components (`"use client"`) do charts/interactivity
- Formatters live in `lib/format.ts` — use them instead of ad-hoc number/date formatting so units stay consistent across views
- Types in `lib/types.ts` are the contract between parser and UI; change them there first
