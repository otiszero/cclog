import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { InjectedCategory, InjectedSource } from "@/lib/types";
import { claudeHome, globalMemoryDir, projectMemoryDir, rulesDir } from "./claude-home";

// Reconstruct the files Claude Code injects into a session's system prompt.
// Only KNOWN filenames are read — never glob a whole project tree (bounds blast
// radius + perf). Missing files are silently omitted, never thrown.
//
// realPath comes from Claude's own recorded cwd (read-project-cwd / decoded
// slug), not from user input, and this is a localhost single-user tool reading
// the user's own disk — so reads following that path (incl. symlinks) are within
// the accepted threat model. We still only ever touch fixed filenames under it.

function readSource(
  path: string,
  category: InjectedCategory,
  scope: "global" | "project",
  label: string,
): InjectedSource | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf8");
    return {
      category,
      label,
      path,
      scope,
      chars: content.length,
      estTokens: Math.ceil(content.length / 4),
      content,
    };
  } catch {
    return null; // unreadable → treat as absent
  }
}

// List *.md files in a dir, sorted alphabetically, with MEMORY.md (the index)
// pulled to the front if present.
function markdownFiles(dir: string): string[] {
  try {
    const md = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    const ordered = md.includes("MEMORY.md")
      ? ["MEMORY.md", ...md.filter((f) => f !== "MEMORY.md")]
      : md;
    return ordered.map((f) => join(dir, f));
  } catch {
    return []; // dir absent
  }
}

// Paths of the global (shared) sources, WITHOUT reading content — cheap enough
// to stat on every request for mtime-based cache invalidation.
export function globalSourcePaths(): string[] {
  return [
    join(claudeHome(), "CLAUDE.md"),
    ...markdownFiles(rulesDir()),
    ...markdownFiles(globalMemoryDir()),
  ].filter((p) => existsSync(p));
}

// Global sources are identical for every project — read once, reuse.
export function collectGlobalSources(): InjectedSource[] {
  const out: InjectedSource[] = [];

  const globalClaude = readSource(
    join(claudeHome(), "CLAUDE.md"),
    "global-instructions",
    "global",
    "CLAUDE.md (user global)",
  );
  if (globalClaude) out.push(globalClaude);

  // Rules files referenced by the global CLAUDE.md and auto-injected by the harness.
  for (const path of markdownFiles(rulesDir())) {
    const src = readSource(path, "global-rules", "global", `rules/${basename(path)}`);
    if (src) out.push(src);
  }

  for (const path of markdownFiles(globalMemoryDir())) {
    const src = readSource(path, "global-memory", "global", `memory/${basename(path)}`);
    if (src) out.push(src);
  }

  return out;
}

// Project-specific sources for one project (its own CLAUDE.md + per-project memory).
export function collectProjectSources(realPath: string, slug: string): InjectedSource[] {
  const out: InjectedSource[] = [];

  for (const name of ["CLAUDE.md", "CLAUDE.local.md"]) {
    const src = readSource(
      join(realPath, name),
      "project-instructions",
      "project",
      name,
    );
    if (src) out.push(src);
  }

  for (const path of markdownFiles(projectMemoryDir(slug))) {
    const src = readSource(path, "project-memory", "project", `memory/${basename(path)}`);
    if (src) out.push(src);
  }

  return out;
}
