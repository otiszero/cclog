---
title: Startup Context Viewer (CLAUDE.md + memory injection)
description: ''
status: completed
priority: P2
branch: feat/activity-analytics
tags: []
blockedBy: []
blocks: []
created: '2026-06-10T07:20:40.868Z'
createdBy: 'ck:plan'
source: skill
---

# Startup Context Viewer (CLAUDE.md + memory injection)

## Overview

Per-project **Startup Context** viewer: reconstruct from disk the CLAUDE.md instruction chain +
rules + memory files that Claude Code injects into every session's system prompt for a project,
with per-file token-cost estimates (chars/4). Answers "how much context am I loaded with before I
even type a prompt, and what's in it" — ties into the app's existing window-pressure/efficiency theme.

**Decisive constraint (verified across 8 sessions):** the injected startup context is NOT stored in
the JSONL transcripts (first user message is always just the user's typed text). So this is a
**disk reconstruction** reflecting CURRENT file state, not a historical per-session snapshot.

**What gets injected** (confirmed against this session's own system prompt):
- Global user instructions: `~/.claude/CLAUDE.md` (~1.0k tok)
- Global rules auto-injected by harness: `~/.claude/rules/*.md` (8 files, ~11k tok) — no `@import`
  syntax; the harness pulls them in because the global CLAUDE.md references them
- Project instructions: `<projectPath>/CLAUDE.md` (+ `CLAUDE.local.md` if present)
- Memory: global `~/.claude/memory/MEMORY.md` + per-project
  `~/.claude/projects/<slug>/memory/MEMORY.md` — NEITHER exists yet → must degrade to "no memory"

**Decisions locked with user:** reconstruct-from-disk ✓ · surface in BOTH a per-project panel AND a
global `/context` comparison route ✓ · show the FULL injected set (global CLAUDE.md + rules + project
CLAUDE.md + memory) ✓.

**Key efficiency insight for the global route:** the global CLAUDE.md + rules + global memory are
SHARED across all projects (same files). Only project CLAUDE.md + project memory differ. So each
project's startup cost = shared base (~12k tok) + project-specific delta. The `/context` route makes
this split explicit.

**Architecture** (mirrors `parser → aggregate → cache → server component → client chart`):
- `collect-injected-files.ts` — pure disk reader → `InjectedSource[]` (shared + per-project)
- `aggregate-startup-context.ts` — assembles `StartupContext` per slug, TTL+mtime cached
- project page: `<StartupContextPanel>` next to `<HarnessPanel>` (page.tsx:83)
- new `/context` route: cross-project comparison table + nav item

Token estimate = `chars / 4` (matches existing hook `estTokens` convention in `parse-session.ts`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Types & File Collector](./phase-01-types-file-collector.md) | Completed |
| 2 | [Aggregator & Cache](./phase-02-aggregator-cache.md) | Completed |
| 3 | [Project-Page Panel](./phase-03-project-page-panel.md) | Completed |
| 4 | [Global Context Route & Nav](./phase-04-global-context-route-nav.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
