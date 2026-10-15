---
phase: 1
title: Types & File Collector
status: completed
priority: P1
effort: 2h
dependencies: []
---

# Phase 1: Types & File Collector

## Overview
Define the parser→UI contract and a pure disk reader that gathers the files Claude Code injects
at session startup for a given project, each tagged with category + token estimate.

## Requirements
- Functional: given a project's real path + slug, return the list of injected sources (global
  CLAUDE.md, global rules/*.md, global memory, project CLAUDE.md(+local), project memory).
- Non-functional: never throw on missing files (most memory files don't exist) — absent file =
  omitted, not an error. Reuse `claude-home.ts` for `~/.claude` resolution.

## Architecture
Data flow: `collectInjectedFiles(realPath, slug)` → `InjectedSource[]` (consumed by Phase 2).

Source resolution (verified on disk):
| Category | Path(s) | Notes |
|---|---|---|
| `global-instructions` | `~/.claude/CLAUDE.md` | always present |
| `global-rules` | `~/.claude/rules/*.md` | 8 files; harness auto-injects (no `@import`) |
| `global-memory` | `~/.claude/memory/MEMORY.md` + `~/.claude/memory/*.md` | currently absent → skip |
| `project-instructions` | `<realPath>/CLAUDE.md`, `<realPath>/CLAUDE.local.md` | local may be absent |
| `project-memory` | `~/.claude/projects/<slug>/memory/MEMORY.md` (+ `*.md`) | currently absent → skip |

Token estimate: `Math.ceil(content.length / 4)` — same convention as `estTokens` in `parse-session.ts`.
Read full content (files are small, <10KB each) so the UI can show/preview it; Phase 2/3 decide
whether to send full body or a preview.

## Related Code Files
- Create: `src/lib/parser/collect-injected-files.ts`
- Modify: `src/lib/types.ts` (add `InjectedCategory`, `InjectedSource`, `StartupContext`, `StartupContextSummary`)
- Read for context: `src/lib/parser/claude-home.ts`, `src/lib/parser/decode-project-path.ts`, `src/lib/parser/parse-session.ts` (estTokens convention)

## Implementation Steps
1. Add to `src/lib/types.ts` (types-first):
   ```ts
   export type InjectedCategory =
     | "global-instructions" | "global-rules" | "global-memory"
     | "project-instructions" | "project-memory";
   export type InjectedSource = {
     category: InjectedCategory;
     label: string;       // display name, e.g. "rules/primary-workflow.md"
     path: string;        // absolute path on disk
     scope: "global" | "project";
     chars: number;
     estTokens: number;   // chars / 4
     content: string;     // full file content
   };
   export type StartupContext = {
     slug: string;
     realPath: string;
     sources: InjectedSource[];
     totalChars: number;
     totalTokens: number;
     byCategory: { category: InjectedCategory; tokens: number; files: number }[];
     sharedTokens: number;   // global-* sources (same for every project)
     projectTokens: number;  // project-* sources (this project only)
   };
   export type StartupContextSummary = {
     sharedTokens: number;   // computed once: all global-* sources
     projects: { slug: string; realPath: string; totalTokens: number; projectTokens: number }[];
   };
   ```
2. Add a `claudeMemoryDir()` / `projectMemoryDir(slug)` helper to `claude-home.ts` if useful, or
   build paths inline (keep `claude-home.ts` the single source of `~/.claude` truth).
3. Create `collect-injected-files.ts`:
   - `export function collectGlobalSources(): InjectedSource[]` — global CLAUDE.md + rules/*.md (sorted) + global memory (if exists). Reused by both per-project and the global route, so factor it out.
   - `export function collectProjectSources(realPath, slug): InjectedSource[]` — project CLAUDE.md/local + project memory dir (if exists).
   - Each read wrapped so a missing file is skipped (use `existsSync` + `readFileSync`, or try/catch).
   - Use `readdirSync` filtered to `.md` for rules/ and memory/ dirs; guard dir-not-exists.

## Success Criteria
- [ ] `collectGlobalSources()` returns global CLAUDE.md + 8 rules files; total ≈ 12k tokens (reconciles with `du`/`wc`).
- [ ] `collectProjectSources(cclogPath, cclogSlug)` returns project CLAUDE.md (~757 tok), no memory (dir absent → omitted, no throw).
- [ ] Missing global/project memory dirs produce zero sources, never an exception.
- [ ] `estTokens === Math.ceil(chars/4)` for every source.
- [ ] `pnpm build` type-checks (types added before consumers).

## Risk Assessment
- **Reading arbitrary project paths**: only read known filenames (`CLAUDE.md`, `CLAUDE.local.md`) under the decoded project path; never glob the whole project tree. Bounds blast radius + perf.
- **Stale decoded path**: `decode-project-path.ts` is heuristic; if `<realPath>/CLAUDE.md` doesn't exist, project-instructions is simply empty (graceful) — surface "no project CLAUDE.md" in UI.
- **Large memory dirs (future)**: cap per-file read and count; if a memory dir has many files, still bounded by `.md` filter. Revisit if it ever gets huge.
