import { statSync } from "node:fs";
import type { ActivityStats, HistoryEntry } from "@/lib/types";
import { historyFile } from "./claude-home";
import { parseHistory } from "./parse-history";

const TTL_MS = 60_000;
const PROJECT_CAP = 30; // perProject rows shown; remainder counted as truncated

// Hybrid cache: mtime catches new prompts immediately on a fresh load; TTL
// bounds staleness if the stat ever fails. Mirrors aggregate-global.ts's
// module-level cache (not cache.ts, which only handles per-session parse).
let cached: { mtimeMs: number; at: number; data: ActivityStats } | null = null;

function historyMtime(): number {
  try {
    return statSync(historyFile()).mtimeMs;
  } catch {
    return -1; // missing file → sentinel
  }
}

function emptyStats(skipped = 0): ActivityStats {
  return {
    totalEntries: 0,
    commandCount: 0,
    promptCount: 0,
    skipped,
    dateRange: { from: 0, to: 0 },
    commandLeaderboard: [],
    heatmap: Array.from({ length: 7 }, () => new Array<number>(24).fill(0)),
    perProject: [],
    perProjectTruncated: 0,
    clearCadence: { clears: 0, avgEntriesBetweenClears: 0 },
  };
}

function reduce(entries: HistoryEntry[], skipped: number): ActivityStats {
  if (entries.length === 0) return emptyStats(skipped);

  const stats = emptyStats(skipped);
  stats.totalEntries = entries.length;

  const cmdCounts = new Map<string, { count: number; namespace?: string }>();
  const projects = new Map<
    string,
    { path: string; total: number; cmd: Map<string, number> }
  >();
  let from = Infinity;
  let to = -Infinity;
  let clears = 0;

  for (const e of entries) {
    if (e.ts < from) from = e.ts;
    if (e.ts > to) to = e.ts;

    if (e.kind === "command") {
      stats.commandCount++;
      if (e.command) {
        const cur = cmdCounts.get(e.command);
        if (cur) cur.count++;
        else cmdCounts.set(e.command, { count: 1, namespace: e.namespace });
        if (e.command === "/clear") clears++;
      }
    } else {
      stats.promptCount++;
    }

    // heatmap bucket — local weekday (0=Sun) × hour
    const d = new Date(e.ts);
    stats.heatmap[d.getDay()][d.getHours()]++;

    // per-project rollup (skip rows with no project path)
    if (e.projectSlug) {
      let p = projects.get(e.projectSlug);
      if (!p) {
        p = { path: e.projectPath, total: 0, cmd: new Map() };
        projects.set(e.projectSlug, p);
      }
      p.total++;
      if (e.command) p.cmd.set(e.command, (p.cmd.get(e.command) ?? 0) + 1);
    }
  }

  stats.dateRange = { from, to };

  stats.commandLeaderboard = [...cmdCounts.entries()]
    .map(([command, v]) => ({ command, count: v.count, namespace: v.namespace }))
    .sort((a, b) => b.count - a.count);

  const allProjects = [...projects.entries()]
    .map(([slug, p]) => ({
      slug,
      path: p.path,
      total: p.total,
      topCommand: topKey(p.cmd),
    }))
    .sort((a, b) => b.total - a.total);
  stats.perProject = allProjects.slice(0, PROJECT_CAP);
  stats.perProjectTruncated = Math.max(0, allProjects.length - PROJECT_CAP);

  stats.clearCadence = {
    clears,
    avgEntriesBetweenClears: clears > 0 ? entries.length / clears : 0,
  };

  return stats;
}

function topKey(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export async function aggregateActivity(): Promise<ActivityStats> {
  const mtimeMs = historyMtime();
  if (cached && cached.mtimeMs === mtimeMs && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }
  const { entries, skipped } = await parseHistory();
  const data = reduce(entries, skipped);
  cached = { mtimeMs, at: Date.now(), data };
  return data;
}

// expose for tests / debugging (parity with cache.ts)
export function clearActivityCache() {
  cached = null;
}
