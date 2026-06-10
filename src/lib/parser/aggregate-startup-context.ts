import { statSync } from "node:fs";
import type { InjectedSource, StartupContext, StartupContextSummary } from "@/lib/types";
import {
  collectGlobalSources,
  collectProjectSources,
  globalSourcePaths,
} from "./collect-injected-files";
import { listProjects } from "./scan-projects";

const TTL_MS = 60_000;

function newestMtime(paths: string[]): number {
  let max = 0;
  for (const p of paths) {
    try {
      const m = statSync(p).mtimeMs;
      if (m > max) max = m;
    } catch {
      /* file vanished between list and stat — ignore */
    }
  }
  return max;
}

// --- shared global block: identical for every project, content read once -----
// Invalidated by mtime (not TTL): statting ~9 small files per request is cheap
// and avoids serving stale content after editing a CLAUDE.md / rules file.
let sharedCache: { mtimeMs: number; sources: InjectedSource[] } | null = null;

function getSharedSources(): InjectedSource[] {
  const mtimeMs = newestMtime(globalSourcePaths());
  if (sharedCache && sharedCache.mtimeMs === mtimeMs) return sharedCache.sources;
  const sources = collectGlobalSources();
  sharedCache = { mtimeMs, sources };
  return sources;
}

function assemble(slug: string, realPath: string, sources: InjectedSource[]): StartupContext {
  const sharedTokens = sources
    .filter((s) => s.scope === "global")
    .reduce((a, s) => a + s.estTokens, 0);
  const projectTokens = sources
    .filter((s) => s.scope === "project")
    .reduce((a, s) => a + s.estTokens, 0);
  return {
    slug,
    realPath,
    sources,
    totalChars: sources.reduce((a, s) => a + s.chars, 0),
    totalTokens: sharedTokens + projectTokens,
    sharedTokens,
    projectTokens,
  };
}

// --- per-project context -----------------------------------------------------
const projectCache = new Map<string, { mtimeMs: number; at: number; data: StartupContext }>();

export async function aggregateStartupContext(
  slug: string,
  realPath: string,
): Promise<StartupContext> {
  const shared = getSharedSources();
  const project = collectProjectSources(realPath, slug);
  const all = [...shared, ...project];
  const mtimeMs = newestMtime(all.map((s) => s.path));

  const cached = projectCache.get(slug);
  if (cached && cached.mtimeMs === mtimeMs && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }
  const data = assemble(slug, realPath, all);
  projectCache.set(slug, { mtimeMs, at: Date.now(), data });
  return data;
}

// --- cross-project summary for the /context route ----------------------------
let summaryCache: { at: number; data: StartupContextSummary } | null = null;

export async function aggregateContextSummary(): Promise<StartupContextSummary> {
  if (summaryCache && Date.now() - summaryCache.at < TTL_MS) return summaryCache.data;

  const shared = getSharedSources();
  const sharedTokens = shared.reduce((a, s) => a + s.estTokens, 0);

  // Per project we only read its own CLAUDE.md / memory (existsSync gates each,
  // so projects without these cost just a stat). Bounded + TTL-cached; fine for a
  // local single-user tool. Revisit with a per-project token cache if it grows.
  const projects = await listProjects();
  const rows = projects.map((p) => {
    const projectTokens = collectProjectSources(p.realPath, p.slug).reduce(
      (a, s) => a + s.estTokens,
      0,
    );
    return {
      slug: p.slug,
      realPath: p.realPath,
      projectTokens,
      totalTokens: sharedTokens + projectTokens,
    };
  });
  rows.sort((a, b) => b.totalTokens - a.totalTokens);

  const data: StartupContextSummary = { sharedTokens, projects: rows };
  summaryCache = { at: Date.now(), data };
  return data;
}

// expose for tests / debugging (parity with other caches)
export function clearStartupContextCache() {
  sharedCache = null;
  summaryCache = null;
  projectCache.clear();
}
