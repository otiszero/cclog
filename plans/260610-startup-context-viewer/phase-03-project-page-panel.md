---
phase: 3
title: Project-Page Panel
status: completed
priority: P2
effort: 2h
dependencies:
  - 2
---

# Phase 3: Project-Page Panel

## Overview
Add a "Startup Context" panel to `/project/[slug]` showing the injected files grouped by category,
each with token cost, an expand-to-read body, and a shared-vs-project token split header.

## Requirements
- Functional: render `StartupContext` — per-category groups, per-file token cost, collapsible full
  content, total + shared/project split.
- Non-functional: client component for collapse interactivity; reuse `.card`, `formatTokens`, CSS
  var tokens; match `HarnessPanel` visual language; keep file <200 lines.

## Architecture
`<StartupContextPanel context={ctx} />` (client). Layout:
- Header: total tokens (big), with "≈ X shared · Y project-specific" sub-line + a one-line explainer
  ("Injected into every session's system prompt before your first prompt").
- Per-category sections (global-instructions → global-rules → global-memory → project-instructions →
  project-memory): category label + summed tokens + file count.
- Each file row: label, token cost, expand toggle → `<pre>` of content (monospace, scrollable, capped
  height). Collapsed by default to keep the page light.
- Empty categories (e.g. memory) render a muted "none" line, not hidden — so the user learns memory exists but is unused.

Page wiring: in `src/app/project/[slug]/page.tsx`, after computing `p`, call
`const ctx = await aggregateStartupContext(decoded, p.realPath)` and render
`<StartupContextPanel context={ctx} />` directly below `<HarnessPanel report={p.harness} />` (line 83).
Reuse `p.realPath` (already decoded by aggregateProject) — do NOT re-decode the slug.

## Related Code Files
- Create: `src/components/project/startup-context-panel.tsx`
- Modify: `src/app/project/[slug]/page.tsx` (fetch ctx + render panel)
- Read for context: `src/components/project/harness-panel.tsx` (panel idiom, collapse pattern, classes), `src/lib/format.ts`

## Implementation Steps
1. Read `harness-panel.tsx` to match section/card/collapse styling and the `"use client"` boundary.
2. Build `startup-context-panel.tsx`:
   - Props: `{ context: StartupContext }`.
   - Header with `formatTokens(context.totalTokens)` + shared/project split.
   - Map categories in fixed display order; within each, list `sources` filtered by category.
   - Per-file expand via local `useState` set of expanded paths; render content in a capped-height `<pre>`.
   - Guard: if `context.sources.length === 0`, show an empty state ("No startup context files found").
3. Wire into the project page (fetch + render below HarnessPanel).
4. `pnpm build` + visit `/project/<cclog slug>`; verify panel shows global CLAUDE.md, 8 rules, project CLAUDE.md, no-memory lines, and totals.

## Success Criteria
- [ ] Panel renders on the cclog project page with correct total (~12.7k tok) and shared/project split.
- [ ] All 8 rules files + global & project CLAUDE.md listed with individual token costs.
- [ ] Expanding a file shows its real content; collapsed by default.
- [ ] Memory categories show a muted "none" (graceful absence).
- [ ] No regression to existing project-page sections (harness, leaderboards, sessions).
- [ ] `pnpm lint` + `pnpm build` clean.

## Risk Assessment
- **Page weight**: full file contents in the DOM (~50KB). Collapsed-by-default `<pre>` keeps render cheap; content already in the server payload. Acceptable; if it ever bloats, switch to a preview + lazy fetch.
- **XSS**: content rendered as text inside `<pre>{content}</pre>` (React escapes) — never `dangerouslySetInnerHTML`.
- **Decoded-path mismatch**: if `p.realPath` has no CLAUDE.md, panel still renders global sources + "no project CLAUDE.md" — verify with a project that lacks one.
