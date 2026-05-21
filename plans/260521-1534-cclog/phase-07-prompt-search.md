# Phase 07 — Cross-Session Prompt Search

## Overview
- **Priority:** P2
- **Status:** pending
- Route `/search`. Full-text search user prompts across all sessions.

## Approach
- Build search index on-demand (first request) using Fuse.js.
- Index doc shape: `{ projectSlug, sessionId, ts, text, tokens, model }`.
- Cache index with TTL 5min; invalidate on project mtime change.
- Server action `searchPrompts(query)` returns top 50 matches with snippet highlights.

## UI
- Input field (debounced 300ms) → results list.
- Each result card: project name · timestamp · model · token count · snippet (with highlight).
- Click → deep link to session view, scroll to that turn.

## Files
- `src/app/search/page.tsx`
- `src/app/search/actions.ts` (server action)
- `src/lib/parser/build-prompt-index.ts`
- `src/components/search/search-input.tsx`
- `src/components/search/result-card.tsx`

## Success
- Query returns in <500ms with index warm.
- Click result lands on correct turn in session view.

## Risks
- Index size for power users → cap at last 90 days of prompts.
- Fuse weight tuning — start with default, iterate.

## Todo
- [ ] build-prompt-index.ts with 5min TTL
- [ ] search server action
- [ ] page.tsx with debounced input
- [ ] result-card.tsx with deep link
- [ ] turn scroll target in session view
