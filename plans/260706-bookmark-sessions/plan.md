---
title: Bookmark Sessions
description: >-
  Let users bookmark (star) any session and revisit it from a dedicated
  Bookmarks page.
status: completed
priority: P2
branch: feat/activity-analytics
tags: []
blockedBy: []
blocks: []
created: '2026-07-06T08:53:07.271Z'
createdBy: 'ck:plan'
source: skill
---

# Bookmark Sessions

## Overview

Add the ability to bookmark a session so the user can find it again later. A star
toggle appears on the session detail page and on each row of a project's session
list. Bookmarks persist to a small JSON file under `CLAUDE_HOME` (`~/.claude/cclog/bookmarks.json`),
consistent with the app's "local filesystem, nothing leaves the machine" design.
A new `/bookmarks` route lists every bookmarked session with its metadata (project,
tokens, cost, last active) and a direct link back into the session view.

**Why server-side JSON, not `localStorage`:** the app's architecture is
server-components-do-data. A file store lets the `/bookmarks` page render server-side
(reusing the existing `getParsedSession` cache to resolve metadata), keeps bookmarks
portable across browsers, and matches the existing `claude-home.ts` storage pattern.
`localStorage` would strand data in one browser and force a client-only page.

**Key identity:** a bookmark is keyed by `projectSlug` + `sessionId`, matching the
route `/project/[slug]/session/[id]`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Store & Server Actions](./phase-01-store-server-actions.md) | Completed |
| 2 | [Bookmark Toggle UI](./phase-02-bookmark-toggle-ui.md) | Completed |
| 3 | [Bookmarks Page & Nav](./phase-03-bookmarks-page-nav.md) | Completed |

## Key Decisions

- **Storage**: `~/.claude/cclog/bookmarks.json` (via new `bookmarksFile()` in `claude-home.ts`). Atomic write (temp file + rename). Zod-validated on read; corrupt/missing file → empty list.
- **Schema**: `{ slug, sessionId, label?, createdAt }`. `label` optional and forward-compatible; MVP UI does not edit it (kept minimal per YAGNI).
- **Mutation**: Next.js server actions (`toggle`, `remove`) + `revalidatePath`. No new HTTP API surface.
- **No new cache layer**: bookmarks file is tiny — read fresh per request. Session metadata on `/bookmarks` reuses the existing mtime-keyed `getParsedSession` cache.

## Dependencies

None. Self-contained; touches no other in-flight plan (both recent plans are `completed`).
Builds only on existing parser/cache + layout primitives.
