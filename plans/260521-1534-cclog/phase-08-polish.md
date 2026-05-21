# Phase 08 — Polish

## Overview
- **Priority:** P2
- **Status:** pending
- Dark mode, error boundaries, empty states, docs.

## Items
- Dark mode toggle (shadcn theme provider + system preference).
- Top navbar: logo, links (Home / Search), theme toggle.
- Error boundaries per route → friendly message + "view raw jsonl" link.
- Empty states (no projects, no sessions, no search results) with helpful hints.
- Loading skeletons for every list/chart.
- Keyboard shortcuts: `/` focus search, `g h` go home.
- README:
  - Setup (`pnpm install && pnpm dev`).
  - Architecture diagram (ASCII).
  - Pricing table source + how to update.
  - "Numbers may diverge from Anthropic billing" disclaimer.
- Final pass: lint, typecheck, build (`pnpm build`).

## Files
- `src/components/layout/navbar.tsx`
- `src/components/layout/theme-toggle.tsx`
- `src/components/common/empty-state.tsx`
- `src/components/common/error-fallback.tsx`
- `src/app/global-error.tsx`
- `README.md` (expanded)

## Success
- `pnpm build` passes (no TS or lint errors).
- All routes have loading + empty + error states.
- Dark + light look polished.

## Todo
- [ ] navbar + theme toggle
- [ ] empty-state + error-fallback
- [ ] route-level loading.tsx + error.tsx
- [ ] keyboard shortcuts hook
- [ ] expanded README
- [ ] pnpm build green
