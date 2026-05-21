import type {
  LeaderboardRow,
  ParsedSession,
  SessionEvent,
  TokenUsage,
} from "@/lib/types";
import { estimateCost } from "@/lib/pricing";
import { categorizeTool, toolDisplayName } from "./categorize-tool";

const ZERO: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };

export function totalTokens(events: SessionEvent[]): TokenUsage {
  return events.reduce<TokenUsage>((acc, e) => (e.kind === "turn" ? addUsage(acc, e.usage) : acc), {
    ...ZERO,
  });
}

export function modelsUsed(events: SessionEvent[]): string[] {
  return [...new Set(events.filter((e) => e.kind === "turn").map((e) => (e as { model: string }).model))];
}

export function estimateSessionCost(events: SessionEvent[]): number {
  let total = 0;
  for (const e of events) {
    if (e.kind === "turn") total += estimateCost(e.model, e.usage);
  }
  return total;
}

export function tokensByTool(parsed: ParsedSession): LeaderboardRow[] {
  // attribute tokens of a turn to each tool_use within it (proportional split: simple even split)
  const groups = new Map<string, { count: number; tokens: TokenUsage; cost: number }>();
  for (const e of parsed.events) {
    if (e.kind !== "turn" || e.toolUses.length === 0) continue;
    const per: TokenUsage = scaleUsage(e.usage, 1 / e.toolUses.length);
    const perCost = estimateCost(e.model, per);
    for (const ref of e.toolUses) {
      const key = ref.category === "sub_agent" || ref.category === "skill" || ref.category === "mcp"
        ? toolDisplayName(ref.name, { /* unused for grouping */ })
        : ref.name;
      const cur = groups.get(key) ?? { count: 0, tokens: { ...ZERO }, cost: 0 };
      cur.count += 1;
      cur.tokens = addUsage(cur.tokens, per);
      cur.cost += perCost;
      groups.set(key, cur);
    }
  }
  return toLeaderboard(groups);
}

export function leaderboardByCategory(
  parsed: ParsedSession,
  category: "tool" | "mcp" | "skill" | "sub_agent",
): LeaderboardRow[] {
  const groups = new Map<string, { count: number; tokens: TokenUsage; cost: number }>();
  for (const e of parsed.events) {
    if (e.kind !== "turn" || e.toolUses.length === 0) continue;
    const matching = e.toolUses.filter((t) => t.category === category);
    if (matching.length === 0) continue;
    const per: TokenUsage = scaleUsage(e.usage, 1 / e.toolUses.length);
    const perCost = estimateCost(e.model, per);
    for (const ref of matching) {
      // for skill/sub_agent we want labeled name → look up by uuid for the original tool_use
      const tu = parsed.events.find(
        (x) => x.kind === "tool_use" && x.uuid === ref.uuid,
      ) as Extract<SessionEvent, { kind: "tool_use" }> | undefined;
      const key = tu ? toolDisplayName(tu.name, tu.input) : ref.name;
      const cur = groups.get(key) ?? { count: 0, tokens: { ...ZERO }, cost: 0 };
      cur.count += 1;
      cur.tokens = addUsage(cur.tokens, per);
      cur.cost += perCost;
      groups.set(key, cur);
    }
  }
  return toLeaderboard(groups);
}

export function turnSeries(parsed: ParsedSession) {
  return parsed.events
    .filter((e): e is Extract<SessionEvent, { kind: "turn" }> => e.kind === "turn")
    .map((e, i) => ({
      idx: i + 1,
      ts: e.ts,
      input: e.usage.input,
      output: e.usage.output,
      cacheRead: e.usage.cacheRead,
      cacheCreate: e.usage.cacheCreate,
      model: e.model,
      durationMs: e.durationMs ?? 0,
      cost: estimateCost(e.model, e.usage),
      toolCount: e.toolUses.length,
    }));
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheCreate: a.cacheCreate + b.cacheCreate,
  };
}

function scaleUsage(u: TokenUsage, k: number): TokenUsage {
  return {
    input: u.input * k,
    output: u.output * k,
    cacheRead: u.cacheRead * k,
    cacheCreate: u.cacheCreate * k,
  };
}

function toLeaderboard(
  groups: Map<string, { count: number; tokens: TokenUsage; cost: number }>,
): LeaderboardRow[] {
  return [...groups.entries()]
    .map(([key, v]) => ({ key, count: v.count, tokens: v.tokens, estCostUsd: v.cost }))
    .sort((a, b) => sumTokens(b.tokens) - sumTokens(a.tokens));
}

export function sumTokens(t: TokenUsage): number {
  return t.input + t.output + t.cacheRead + t.cacheCreate;
}
