---
phase: 2
title: Bookmark Toggle UI
status: completed
priority: P1
effort: 2h
dependencies:
  - 1
---

# Phase 2: Bookmark Toggle UI

## Overview

A reusable star toggle (client component) that flips a session's bookmark state via
the Phase 1 server action, with optimistic UI. Wire it into the session detail header
and each row of the project session list.

## Requirements

- Functional: click star → toggles bookmark; icon reflects current state (filled = bookmarked). Works without a full page reload.
- Non-functional: accessible (`aria-pressed`, label), no layout shift, matches existing icon style (`stroke="currentColor"`, 1.75 width).

## Architecture

- `BookmarkToggle` is `"use client"`. Props: `slug`, `sessionId`, `initialBookmarked`.
- Uses `useState` for optimistic state + `useTransition` to call `toggleBookmarkAction`; reverts on error.
- Server components pass `initialBookmarked` from `isBookmarked(...)` so first paint is correct.

## Related Code Files

- Create: `src/components/session/bookmark-toggle.tsx` — the client star button.
- Modify: `src/app/project/[slug]/session/[id]/page.tsx` — resolve `isBookmarked`, render toggle in header.
- Modify: `src/app/project/[slug]/page.tsx` — resolve bookmark state per session; add a bookmark column/cell with the toggle. Bookmarked set fetched once via `readBookmarks()` then looked up (avoid N file reads).

## Implementation Steps

1. Create `bookmark-toggle.tsx`:
   ```tsx
   "use client";
   import { useState, useTransition } from "react";
   import { toggleBookmarkAction } from "@/app/bookmarks/actions";

   export function BookmarkToggle({ slug, sessionId, initialBookmarked }: {
     slug: string; sessionId: string; initialBookmarked: boolean;
   }) {
     const [on, setOn] = useState(initialBookmarked);
     const [pending, start] = useTransition();
     function toggle() {
       const next = !on;
       setOn(next); // optimistic
       start(async () => {
         try { setOn(await toggleBookmarkAction(slug, sessionId)); }
         catch { setOn(!next); } // revert
       });
     }
     return (
       <button type="button" onClick={toggle} aria-pressed={on} disabled={pending}
         title={on ? "Remove bookmark" : "Bookmark this session"}
         aria-label={on ? "Remove bookmark" : "Bookmark this session"}>
         <svg width={18} height={18} viewBox="0 0 24 24"
           fill={on ? "currentColor" : "none"} stroke="currentColor"
           strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
           <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
         </svg>
       </button>
     );
   }
   ```
   Style the button with the app's muted/accent color vars; filled star uses accent when `on`.
2. Session detail page (`session/[id]/page.tsx`): after resolving `parsed`, call
   `const bookmarked = await isBookmarked(decodedSlug, id);` and render
   `<BookmarkToggle slug={decodedSlug} sessionId={id} initialBookmarked={bookmarked} />`
   in the `<header>`, right-aligned next to the `<h1>` session id.
3. Project page (`project/[slug]/page.tsx`): once, `const marks = new Set((await readBookmarks()).filter(b => b.slug === decoded).map(b => b.sessionId));`
   Add a leading or trailing table cell per row:
   `<BookmarkToggle slug={p.slug} sessionId={s.sessionId} initialBookmarked={marks.has(s.sessionId)} />`
   Add a matching `<th>` (empty or a small star) in `<thead>`.
4. `pnpm build` + manual smoke: `pnpm dev`, star a session, reload → still starred.

## Success Criteria

- [ ] Star toggles on both the session page and project list rows.
- [ ] State persists across reload (server reads it back).
- [ ] Optimistic flip is instant; failed action reverts.
- [ ] `aria-pressed` reflects state; button reachable by keyboard.
- [ ] No new prop-drilling of the whole bookmark list into rows (single `Set` lookup).

## Risk Assessment

- **N+1 file reads on project list**: avoided by reading bookmarks once into a `Set`.
- **Optimistic desync**: server action returns authoritative boolean; state is set from the response, so a race resolves to the server's truth.
- **Icon color in light/dark**: use existing CSS vars (`--accent`/`--muted`) so it works in both themes.
