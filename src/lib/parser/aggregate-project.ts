import { stat } from "node:fs/promises";
import type {
  LeaderboardRow,
  ProjectSummary,
  SessionMeta,
  TokenUsage,
} from "@/lib/types";
import { estimateCost } from "@/lib/pricing";
import { getParsedSession } from "./cache";
import { decodeProjectSlug } from "./decode-project-path";
import { readProjectCwd } from "./read-project-cwd";
import { listSessionFiles } from "./scan-projects";
import {
  addUsage,
  estimateSessionCost,
  leaderboardByCategory,
  modelsUsed,
  sumTokens,
  totalTokens,
} from "./derive-metrics";
import { aggregateEfficiency, deriveEfficiency } from "./derive-efficiency";

const ZERO: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
const cache = new Map<string, { mtime: number; summary: ProjectSummary }>();

export async function aggregateProject(slug: string): Promise<ProjectSummary> {
  const files = await listSessionFiles(slug);
  let newestMtime = 0;
  for (const f of files) {
    try {
      const st = await stat(f);
      if (st.mtimeMs > newestMtime) newestMtime = st.mtimeMs;
    } catch {
      /* ignore */
    }
  }
  const cached = cache.get(slug);
  if (cached && cached.mtime === newestMtime) return cached.summary;

  let lifetime: TokenUsage = { ...ZERO };
  let cost = 0;
  let lastActive: string | undefined;
  const sessions: SessionMeta[] = [];
  const toolGroup = new Map<string, LeaderboardRow>();
  const mcpGroup = new Map<string, LeaderboardRow>();
  const skillGroup = new Map<string, LeaderboardRow>();
  const subAgentGroup = new Map<string, LeaderboardRow>();
  const daily = new Map<string, { tokens: number; cost: number }>();

  for (const file of files) {
    let st;
    try {
      st = await stat(file);
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = await getParsedSession(file, slug);
    } catch {
      continue;
    }
    const tokens = totalTokens(parsed.events);
    const sessionCost = estimateSessionCost(parsed.events);
    lifetime = addUsage(lifetime, tokens);
    cost += sessionCost;
    if (parsed.endedAt && (!lastActive || parsed.endedAt > lastActive)) lastActive = parsed.endedAt;

    const efficiency = deriveEfficiency(parsed);
    sessions.push({
      sessionId: parsed.sessionId,
      filePath: parsed.filePath,
      projectSlug: slug,
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      turnCount: parsed.events.filter((e) => e.kind === "turn").length,
      totalTokens: tokens,
      models: modelsUsed(parsed.events),
      estCostUsd: sessionCost,
      fileBytes: st.size,
      efficiency,
    });

    mergeLeaderboard(toolGroup, leaderboardByCategory(parsed, "tool"));
    mergeLeaderboard(mcpGroup, leaderboardByCategory(parsed, "mcp"));
    mergeLeaderboard(skillGroup, leaderboardByCategory(parsed, "skill"));
    mergeLeaderboard(subAgentGroup, leaderboardByCategory(parsed, "sub_agent"));

    // daily series — bucket by startedAt date
    const date = parsed.startedAt?.slice(0, 10);
    if (date) {
      const cur = daily.get(date) ?? { tokens: 0, cost: 0 };
      cur.tokens += sumTokens(tokens);
      cur.cost += sessionCost;
      daily.set(date, cur);
    }
  }

  const cwd = await readProjectCwd(slug);
  const summary: ProjectSummary = {
    slug,
    realPath: cwd ?? decodeProjectSlug(slug),
    sessionCount: files.length,
    lifetimeTokens: lifetime,
    estCostUsd: cost,
    lastActive,
    byTool: sortLeaderboard(toolGroup),
    byMcp: sortLeaderboard(mcpGroup),
    bySkill: sortLeaderboard(skillGroup),
    bySubAgent: sortLeaderboard(subAgentGroup),
    dailyTokens: [...daily.entries()]
      .map(([date, v]) => ({ date, tokens: v.tokens, cost: v.cost }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    sessions: sessions.sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? "")),
    efficiency: aggregateEfficiency(
      sessions.map((s) => ({
        report: s.efficiency,
        weight: sumTokens(s.totalTokens),
      })),
    ),
  };

  cache.set(slug, { mtime: newestMtime, summary });
  return summary;
}

function mergeLeaderboard(target: Map<string, LeaderboardRow>, rows: LeaderboardRow[]) {
  for (const r of rows) {
    const cur = target.get(r.key);
    if (cur) {
      cur.count += r.count;
      cur.tokens = addUsage(cur.tokens, r.tokens);
      cur.estCostUsd += r.estCostUsd;
    } else {
      target.set(r.key, { ...r, tokens: { ...r.tokens } });
    }
  }
  void estimateCost; // keep import used in derive-metrics paths
}

function sortLeaderboard(g: Map<string, LeaderboardRow>): LeaderboardRow[] {
  return [...g.values()].sort((a, b) => sumTokens(b.tokens) - sumTokens(a.tokens));
}
