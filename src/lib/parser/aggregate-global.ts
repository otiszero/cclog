import type { ProjectSummary, TokenUsage } from "@/lib/types";
import { aggregateProject } from "./aggregate-project";
import { listProjects } from "./scan-projects";
import { addUsage, sumTokens } from "./derive-metrics";

const ZERO: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
const TTL_MS = 60_000;
let cached: { at: number; data: GlobalSummary } | null = null;

export type GlobalSummary = {
  totalProjects: number;
  totalSessions: number;
  lifetimeTokens: TokenUsage;
  estCostUsd: number;
  avgCostPerSession: number;
  byModel: { model: string; tokens: number; cost: number }[];
  topProjects: ProjectSummary[];
  allProjects: ProjectSummary[];
  daily: { date: string; tokens: number; cost: number }[];
  topTools: { key: string; tokens: number; cost: number }[];
};

export async function aggregateGlobal(): Promise<GlobalSummary> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  const projects = await listProjects();
  const summaries: ProjectSummary[] = [];
  for (const p of projects) {
    try {
      summaries.push(await aggregateProject(p.slug));
    } catch {
      /* ignore individual failures */
    }
  }

  let lifetime: TokenUsage = { ...ZERO };
  let cost = 0;
  let sessionCount = 0;
  const modelMap = new Map<string, { tokens: number; cost: number }>();
  const dailyMap = new Map<string, { tokens: number; cost: number }>();
  const toolMap = new Map<string, { tokens: number; cost: number }>();

  for (const s of summaries) {
    lifetime = addUsage(lifetime, s.lifetimeTokens);
    cost += s.estCostUsd;
    sessionCount += s.sessionCount;
    for (const ses of s.sessions) {
      for (const m of ses.models) {
        const cur = modelMap.get(m) ?? { tokens: 0, cost: 0 };
        cur.tokens += sumTokens(ses.totalTokens);
        cur.cost += ses.estCostUsd;
        modelMap.set(m, cur);
      }
    }
    for (const d of s.dailyTokens) {
      const cur = dailyMap.get(d.date) ?? { tokens: 0, cost: 0 };
      cur.tokens += d.tokens;
      cur.cost += d.cost;
      dailyMap.set(d.date, cur);
    }
    for (const row of s.byTool) {
      const cur = toolMap.get(row.key) ?? { tokens: 0, cost: 0 };
      cur.tokens += sumTokens(row.tokens);
      cur.cost += row.estCostUsd;
      toolMap.set(row.key, cur);
    }
  }

  const data: GlobalSummary = {
    totalProjects: summaries.length,
    totalSessions: sessionCount,
    lifetimeTokens: lifetime,
    estCostUsd: cost,
    avgCostPerSession: sessionCount > 0 ? cost / sessionCount : 0,
    byModel: [...modelMap.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.tokens - a.tokens),
    topProjects: [...summaries]
      .sort((a, b) => b.estCostUsd - a.estCostUsd)
      .slice(0, 20),
    allProjects: [...summaries].sort((a, b) =>
      (b.lastActive ?? "").localeCompare(a.lastActive ?? ""),
    ),
    daily: [...dailyMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30),
    topTools: [...toolMap.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10),
  };
  cached = { at: Date.now(), data };
  return data;
}
