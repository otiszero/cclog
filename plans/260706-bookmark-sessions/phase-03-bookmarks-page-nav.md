---
phase: 3
title: Bookmarks Page & Nav
status: completed
priority: P2
effort: 2h
dependencies:
  - 1
  - 2
---

# Phase 3: Bookmarks Page & Nav

## Overview

A `/bookmarks` route that lists every bookmarked session with resolved metadata and a
link back into the session, plus a "Bookmarks" item in the sidebar nav. Completes the
"revisit it later" loop.

## Requirements

- Functional: show all bookmarks newest-first; each shows project path, started time, tokens, cost, and a link to the session. Remove action per row. Empty state when none.
- Non-functional: reuse the existing session cache (no re-parsing cost beyond first read); stale bookmarks (deleted session file) render gracefully.

## Architecture

- Server component reads `readBookmarks()`, then for each resolves a `SessionMeta` by
  reusing `getParsedSession(join(projectsDir(), slug, sessionId + ".jsonl"), slug)` and
  `readProjectCwd(slug)`. Build `BookmarkedSession[]` (Phase 1 type). Missing file → `meta: null`.
- Sort by `bookmark.createdAt` desc (fallback to session `startedAt`).
- Remove uses the Phase 1 `removeBookmarkAction` via a small client button (reuse pattern from `BookmarkToggle`, or the toggle itself renders here too).

## Related Code Files

- Create: `src/app/bookmarks/page.tsx` — server component list + empty state.
- Modify: `src/components/layout/sidebar-nav-items.tsx` — add `Bookmarks` NavItem (star icon) after `Search`.
- Reuse: `src/components/common/empty-state.tsx`, `src/lib/format.ts`, `BookmarkToggle`.

## Implementation Steps

1. Create `bookmarks/page.tsx` (`export const dynamic = "force-dynamic"`):
   - `const bookmarks = await readBookmarks();`
   - Resolve each in parallel:
     ```ts
     const rows = await Promise.all(bookmarks.map(async (b) => {
       const file = join(projectsDir(), b.slug, `${b.sessionId}.jsonl`);
       let meta = null;
       try {
         const parsed = await getParsedSession(file, b.slug);
         meta = parsed ? { started: parsed.startedAt, tokens: sumTokens(totalTokens(parsed.events)),
                           cost: estimateSessionCost(parsed.events), models: modelsUsed(parsed.events) } : null;
       } catch { /* file gone → stale bookmark */ }
       const realPath = (await readProjectCwd(b.slug)) ?? decodeProjectSlug(b.slug);
       return { b, meta, realPath };
     }));
     ```
   - Sort by `b.createdAt` desc.
   - Render a `card` with a `table.data` (columns: Bookmarked, Project, Started, Tokens, Cost, Session link, ✕remove). Reuse `formatRelative`/`formatTokens`/`formatCost`.
   - Stale rows (`meta === null`): show project + session id + "session file no longer exists" muted, still allow remove.
   - Zero bookmarks → `<EmptyState>` with hint "Star a session to pin it here."
2. Header mirrors other pages: `<h1>Bookmarks</h1>` + count subtitle.
3. Add NavItem in `sidebar-nav-items.tsx` (after Search), reuse the bookmark star `path` from Phase 2:
   ```tsx
   { href: "/bookmarks", label: "Bookmarks",
     icon: (<svg {...iconProps}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>) }
   ```
   `isActive` already handles the new route (exact + prefix match).
4. `pnpm build` + smoke: bookmark 2 sessions, open `/bookmarks`, verify links, remove one, delete a session's jsonl and confirm the stale row renders + is removable.

## Success Criteria

- [ ] `/bookmarks` lists all bookmarks newest-first with project, tokens, cost, and working session links.
- [ ] Sidebar shows "Bookmarks" with active-state highlight when on the route.
- [ ] Removing a bookmark updates the list without full reload (revalidate).
- [ ] Empty state shows when there are no bookmarks.
- [ ] A bookmark whose session file was deleted renders gracefully and can still be removed.
- [ ] `pnpm build` passes.

## Risk Assessment

- **Stale bookmarks** (session file deleted/rotated): handled via `meta: null` branch; user can remove.
- **Metadata cost**: `getParsedSession` is mtime-cached, so repeat visits are cheap; first visit parses each bookmarked file once (bounded by bookmark count, expected small).
- **Nav ordering**: appending after Search keeps primary analytics nav stable; Bookmarks is a utility view.
