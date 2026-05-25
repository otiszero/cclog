import type {
  AntiPatternFinding,
  EfficiencyGrade,
  EfficiencyReport,
  ParsedSession,
  ReReadReason,
  SessionEvent,
} from "@/lib/types";

const DRIFT_TURNS = 8; // turns between re-reads → likely context drift

// Thresholds — v1 hardcoded per brainstorm. Tune later.
const CACHE_GOAL = 0.9; // 90%+ healthy (research: Anthropic doc baseline)
const BIG_TOOL_CHARS = 10_000; // single tool result threshold
const REGREP_MIN = 3; // same file read 3+ times = loop
const NA_MIN_TURNS = 3; // tiny sessions get N/A grade

// Score weights — sum to 100
const W_CACHE = 40;
const W_REREAD = 30;
const W_BLOAT = 30;

export function deriveEfficiency(parsed: ParsedSession): EfficiencyReport {
  const turns = parsed.events.filter(
    (e): e is Extract<SessionEvent, { kind: "turn" }> => e.kind === "turn",
  );
  const tools = parsed.events.filter(
    (e): e is Extract<SessionEvent, { kind: "tool_use" }> => e.kind === "tool_use",
  );

  // --- M1: cache hit rate
  // cacheRead / (cacheRead + input). Excludes output. cacheCreate counts as fresh input cost.
  let cacheRead = 0;
  let freshInput = 0;
  for (const t of turns) {
    cacheRead += t.usage.cacheRead;
    freshInput += t.usage.input + t.usage.cacheCreate;
  }
  const cacheTotal = cacheRead + freshInput;
  const cacheHitRate = cacheTotal > 0 ? cacheRead / cacheTotal : 0;

  // --- M2: re-read waste
  // Among Read tool calls grouped by file_path: repeated reads / total reads.
  const readsByPath = new Map<string, Extract<SessionEvent, { kind: "tool_use" }>[]>();
  for (const tu of tools) {
    if (tu.name !== "Read") continue;
    const path = (tu.input as { file_path?: string } | null)?.file_path;
    if (!path) continue;
    const list = readsByPath.get(path) ?? [];
    list.push(tu);
    readsByPath.set(path, list);
  }
  let totalReads = 0;
  let repeatedReads = 0;
  for (const list of readsByPath.values()) {
    totalReads += list.length;
    if (list.length > 1) repeatedReads += list.length - 1; // first is necessary, rest is waste
  }
  const reReadWaste = totalReads > 0 ? repeatedReads / totalReads : 0;

  // --- M3: tool output bloat
  // Fraction of tool calls whose resultFull is unusually large.
  let totalToolsCounted = 0;
  let bigToolCount = 0;
  for (const tu of tools) {
    if (typeof tu.resultFull !== "string") continue;
    totalToolsCounted += 1;
    if (tu.resultFull.length >= BIG_TOOL_CHARS) bigToolCount += 1;
  }
  const toolBloat = totalToolsCounted > 0 ? bigToolCount / totalToolsCounted : 0;

  // --- Anti-pattern findings
  const findings: AntiPatternFinding[] = [];

  // Index turns by uuid in event order for reason-classification & turns-after counts
  const turnOrderByUuid = new Map<string, number>();
  turns.forEach((t, idx) => turnOrderByUuid.set(t.uuid, idx));

  for (const [path, list] of readsByPath.entries()) {
    if (list.length < REGREP_MIN) continue;
    const reads = list.map((tu, i) => ({
      ts: tu.ts,
      turnUuid: tu.parentTurn,
      reason: classifyReReadReason({
        path,
        currentIdx: i,
        currentTu: tu,
        history: list,
        allTools: tools,
        turnOrderByUuid,
      }),
    }));
    findings.push({
      kind: "re_grep_loop",
      label: shortPath(path),
      detail: `${list.length} reads (${list.length - 1} wasted)`,
      turnUuids: list.map((tu) => tu.parentTurn),
      reReadDetail: { filePath: path, reads },
    });
  }

  for (const tu of tools) {
    if (typeof tu.resultFull !== "string") continue;
    if (tu.resultFull.length < BIG_TOOL_CHARS) continue;
    const ownerIdx = turnOrderByUuid.get(tu.parentTurn) ?? -1;
    const turnsAfter = ownerIdx >= 0 ? Math.max(0, turns.length - 1 - ownerIdx) : 0;
    const estTokens = Math.round(tu.resultFull.length / 4);
    // Cache-read carries: every subsequent turn re-loads this in cached input at ~0.1x cost.
    const estCarriedTokens = estTokens * turnsAfter;
    findings.push({
      kind: "tool_output_explosion",
      label: tu.name,
      detail: `${(tu.resultFull.length / 1024).toFixed(1)}kB · ~${formatN(estTokens)} tok · carried ${turnsAfter} turns`,
      turnUuids: [tu.parentTurn],
      bloatDetail: {
        toolName: tu.name,
        inputSummary: summarizeInput(tu.name, tu.input),
        resultChars: tu.resultFull.length,
        estTokens,
        turnsAfter,
        estCarriedTokens,
      },
    });
  }

  // --- Score (subscores 0-1 then weighted)
  const cacheScore = clamp01(cacheHitRate / CACHE_GOAL);
  const reReadScore = clamp01(1 - reReadWaste / 0.5);
  const bloatScore = clamp01(1 - toolBloat / 0.5);
  const score = Math.round(
    cacheScore * W_CACHE + reReadScore * W_REREAD + bloatScore * W_BLOAT,
  );

  const grade: EfficiencyGrade =
    turns.length < NA_MIN_TURNS ? "N/A" : toGrade(score);

  return {
    score,
    grade,
    cacheHitRate,
    reReadWaste,
    toolBloat,
    totalReads,
    totalTools: totalToolsCounted,
    findings,
  };
}

// Token-weighted aggregate: a session that burned 1M tokens matters more than 5K.
export function aggregateEfficiency(
  parts: { report: EfficiencyReport; weight: number }[],
): EfficiencyReport {
  let wSum = 0;
  let cacheNum = 0;
  let cacheDen = 0;
  let reReadNum = 0;
  let reReadDen = 0;
  let bloatNum = 0;
  let bloatDen = 0;
  let scoreNum = 0;
  let totalReads = 0;
  let totalTools = 0;
  const findings: AntiPatternFinding[] = [];

  for (const { report, weight } of parts) {
    if (weight <= 0) continue;
    if (report.grade === "N/A") continue;
    wSum += weight;
    scoreNum += report.score * weight;
    // For ratio aggregation we reconstruct numerator/denom from the report counts.
    // Cache: weight by total cache+input tokens; approximated by `weight`.
    cacheNum += report.cacheHitRate * weight;
    cacheDen += weight;
    // re-read & bloat weighted by their respective denominators
    reReadNum += report.reReadWaste * report.totalReads;
    reReadDen += report.totalReads;
    bloatNum += report.toolBloat * report.totalTools;
    bloatDen += report.totalTools;
    totalReads += report.totalReads;
    totalTools += report.totalTools;
    findings.push(...report.findings);
  }

  if (wSum === 0) {
    return {
      score: 0,
      grade: "N/A",
      cacheHitRate: 0,
      reReadWaste: 0,
      toolBloat: 0,
      totalReads: 0,
      totalTools: 0,
      findings: [],
    };
  }

  const score = Math.round(scoreNum / wSum);
  return {
    score,
    grade: toGrade(score),
    cacheHitRate: cacheDen > 0 ? cacheNum / cacheDen : 0,
    reReadWaste: reReadDen > 0 ? reReadNum / reReadDen : 0,
    toolBloat: bloatDen > 0 ? bloatNum / bloatDen : 0,
    totalReads,
    totalTools,
    findings, // not displayed at project level, but kept for drill-down later
  };
}

// Set of turn UUIDs flagged by any finding — for timeline highlight.
export function flaggedTurnUuids(report: EfficiencyReport): Set<string> {
  const set = new Set<string>();
  for (const f of report.findings) for (const u of f.turnUuids) set.add(u);
  return set;
}

// Map turn UUID → findings touching it.
export function findingsByTurn(
  report: EfficiencyReport,
): Map<string, AntiPatternFinding[]> {
  const map = new Map<string, AntiPatternFinding[]>();
  for (const f of report.findings) {
    for (const u of f.turnUuids) {
      const list = map.get(u) ?? [];
      list.push(f);
      map.set(u, list);
    }
  }
  return map;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function toGrade(score: number): EfficiencyGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function shortPath(p: string): string {
  const parts = p.split("/");
  return parts.length <= 3 ? p : `…/${parts.slice(-3).join("/")}`;
}

function formatN(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

// Classify why a given Read was made (skipped first read = "first_read").
// Looks at the tool_use events between the previous Read and current Read.
function classifyReReadReason(args: {
  path: string;
  currentIdx: number;
  currentTu: Extract<SessionEvent, { kind: "tool_use" }>;
  history: Extract<SessionEvent, { kind: "tool_use" }>[];
  allTools: Extract<SessionEvent, { kind: "tool_use" }>[];
  turnOrderByUuid: Map<string, number>;
}): ReReadReason {
  const { path, currentIdx, currentTu, history, allTools, turnOrderByUuid } = args;
  if (currentIdx === 0) return "first_read";
  const prev = history[currentIdx - 1];

  // Duplicate within same turn (or same prompt-group): batch confusion
  if (prev.parentTurn === currentTu.parentTurn) return "duplicate_same_batch";

  const prevOrder = turnOrderByUuid.get(prev.parentTurn) ?? -1;
  const curOrder = turnOrderByUuid.get(currentTu.parentTurn) ?? -1;

  // Scan tool events between previous and current Read for clues
  let sawEditOnSameFile = false;
  let sawSubAgent = false;
  for (const t of allTools) {
    const o = turnOrderByUuid.get(t.parentTurn) ?? -1;
    if (o <= prevOrder || o >= curOrder) continue;
    if (t.name === "Edit" || t.name === "Write" || t.name === "MultiEdit") {
      const p = (t.input as { file_path?: string } | null)?.file_path;
      if (p === path) sawEditOnSameFile = true;
    }
    if (t.name === "Task") sawSubAgent = true;
  }

  if (sawEditOnSameFile) return "re_verify_after_edit";
  if (sawSubAgent) return "after_sub_agent";
  if (curOrder - prevOrder >= DRIFT_TURNS) return "context_drift";
  return "unknown";
}

function summarizeInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const i = input as Record<string, unknown>;
  if (typeof i.file_path === "string") return i.file_path;
  if (typeof i.path === "string") return i.path;
  if (typeof i.command === "string") return String(i.command).slice(0, 160);
  if (typeof i.pattern === "string") return `pattern: ${i.pattern}`;
  if (typeof i.url === "string") return String(i.url);
  return toolName;
}
