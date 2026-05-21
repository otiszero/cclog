# Codebase Summary

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Recharts · Fuse.js · Zod · date-fns · react-markdown · pnpm.

No test framework configured.

## Layout
```
src/
├── app/                                # Next.js routes
│   ├── page.tsx                        # /
│   ├── project/[slug]/page.tsx         # project rollup
│   ├── project/[slug]/session/[id]/    # session detail
│   ├── search/                         # cross-session prompt search
│   └── globals.css                     # tokens (--card, --accent, --positive, --warning, …)
├── components/
│   ├── common/                         # KpiCard, etc.
│   ├── global/                         # home page widgets
│   ├── layout/                         # navbar
│   ├── project/                        # leaderboards, usage chart
│   └── session/                        # session-tabs, timeline-*, tokens chart, prompt viewer
└── lib/
    ├── parser/                         # see system-architecture.md
    ├── format.ts                       # formatTokens / formatCost / formatDuration / formatRelative
    ├── pricing.ts                      # static $/MTok table + PRICING_AS_OF
    └── types.ts                        # SessionEvent, ParsedSession, ProjectSummary, LeaderboardRow
```

## Key contracts
- `lib/types.ts` is the contract between parser and UI — change types **first** when adding fields.
- Server components do data; client components (`"use client"`) do charts/interactivity.
- Formatters live in `lib/format.ts` — use them, don't ad-hoc.

## Components — session/
| File | Responsibility |
|---|---|
| `session-tabs.tsx` | Tab switcher: timeline / tokens / prompts |
| `timeline-waterfall.tsx` | Vertical row list, prompt + turn rows, expand to details |
| `timeline-token-bar.tsx` | Two stacked-segment bars per turn (ctx + work) |
| `timeline-legend.tsx` | Collapsible explainer for what each visual element means |
| `tokens-stacked-chart.tsx` | Recharts stacked bar: tokens per turn |
| `prompt-viewer.tsx` | Markdown-rendered prompts/responses |

## Recent notable change
Timeline tab refactor (2026-05): split into legend + token-bar + waterfall files. Added second "work" bar (output + cache-creation only) because the original single bar was dominated by `cacheRead` in long sessions and visually misleading.
