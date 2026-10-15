---
phase: 1
title: Store & Server Actions
status: completed
priority: P1
effort: 2h
dependencies: []
---

# Phase 1: Store & Server Actions

## Overview

Build the persistence layer: a Zod-validated JSON store under `CLAUDE_HOME`, plus
Next.js server actions to toggle and remove bookmarks. This is the foundation the UI
phases depend on.

## Requirements

- Functional: read all bookmarks; check if a session is bookmarked; toggle (add/remove); remove by key. Survives process restarts.
- Non-functional: no data loss on concurrent-ish writes (atomic replace); corrupt/missing file degrades to empty list, never throws to the UI.

## Architecture

```
UI (client) → server action (toggleBookmark / removeBookmark)
                    ↓ read-modify-write
              bookmarks-store.ts  ──►  ~/.claude/cclog/bookmarks.json
                    ↑ read
          /bookmarks page + toggle initial state (server components)
```

- `Bookmark` type is the parser↔UI contract → declare in `lib/types.ts`.
- Store owns file I/O only. Server actions own revalidation.

## Related Code Files

- Create: `src/lib/bookmarks/bookmarks-store.ts` — read/list/isBookmarked/toggle/remove + Zod schema, atomic write.
- Create: `src/app/bookmarks/actions.ts` — `"use server"` actions wrapping the store + `revalidatePath`.
- Modify: `src/lib/parser/claude-home.ts` — add `cclogDataDir()` and `bookmarksFile()`.
- Modify: `src/lib/types.ts` — add `Bookmark` type (and `BookmarkedSession` used by Phase 3).

## Implementation Steps

1. In `claude-home.ts` add:
   ```ts
   export function cclogDataDir(): string { return join(claudeHome(), "cclog"); }
   export function bookmarksFile(): string { return join(cclogDataDir(), "bookmarks.json"); }
   ```
2. In `types.ts` add:
   ```ts
   export type Bookmark = { slug: string; sessionId: string; label?: string; createdAt: string };
   // Used by Phase 3 — a bookmark joined with resolved session metadata (null if the file vanished).
   export type BookmarkedSession = { bookmark: Bookmark; meta: SessionMeta | null; realPath: string };
   ```
3. Create `bookmarks-store.ts`:
   - Zod schema: `z.array(z.object({ slug: z.string(), sessionId: z.string(), label: z.string().optional(), createdAt: z.string() }))`.
   - `readBookmarks(): Promise<Bookmark[]>` — read file; `JSON.parse` → `safeParse`. On ENOENT / parse fail / validation fail → return `[]`.
   - `isBookmarked(slug, sessionId)` — convenience over `readBookmarks`.
   - `writeBookmarks(list)` — `mkdir(cclogDataDir, { recursive: true })`, write to `bookmarks.json.tmp`, then `rename` over the real file (atomic replace).
   - `toggleBookmark(slug, sessionId)` — read, remove matching `(slug,sessionId)` if present else push `{ slug, sessionId, createdAt: new Date().toISOString() }`, write. Return the new boolean state.
   - `removeBookmark(slug, sessionId)` — read, filter out, write.
   - Key match helper: `(b) => b.slug === slug && b.sessionId === sessionId`.
4. Create `src/app/bookmarks/actions.ts`:
   ```ts
   "use server";
   import { revalidatePath } from "next/cache";
   import { toggleBookmark, removeBookmark } from "@/lib/bookmarks/bookmarks-store";

   export async function toggleBookmarkAction(slug: string, sessionId: string) {
     const state = await toggleBookmark(slug, sessionId);
     revalidatePath("/bookmarks");
     revalidatePath(`/project/${encodeURIComponent(slug)}`);
     revalidatePath(`/project/${encodeURIComponent(slug)}/session/${sessionId}`);
     return state;
   }
   export async function removeBookmarkAction(slug: string, sessionId: string) {
     await removeBookmark(slug, sessionId);
     revalidatePath("/bookmarks");
   }
   ```
5. `pnpm build` (or `pnpm lint`) to confirm types compile.

## Success Criteria

- [ ] `bookmarks-store.ts` under 200 lines, no `any`, all file errors caught.
- [ ] Toggling twice returns to original state; file content round-trips through Zod.
- [ ] Missing/corrupt `bookmarks.json` yields `[]` (verified by deleting/garbling the file).
- [ ] `pnpm build` passes with no type errors.

## Risk Assessment

- **Concurrent writes** (two tabs): single local user, low probability. Atomic temp+rename prevents a torn file; last-writer-wins on content is acceptable. No locking (YAGNI).
- **Server-action cross-origin**: Next 16 default action security is fine for localhost; no extra config.
- **`revalidatePath` on dynamic pages**: pages already use `force-dynamic`, so revalidation just clears the router cache — safe.
