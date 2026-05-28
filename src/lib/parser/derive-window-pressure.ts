import type {
  AntiPatternFinding,
  ParsedSession,
  SessionEvent,
} from "@/lib/types";

// Claude Code's primary models all advertise a 200k context window.
// "unknown" falls back to 200k so we don't divide by zero.
const CONTEXT_LIMITS: Record<string, number> = {
  default: 200_000,
};

const COMPACTION_THRESHOLD = 0.8; // ≥ 80% full → recommend compaction
const LIM_MIN_KB = 5; // size > 5KB
const LIM_LO = 0.3; // position ∈ [0.3, 0.7]
const LIM_HI = 0.7;

export function contextLimitFor(model: string): number {
  // All known Claude models (Opus/Sonnet/Haiku 3.x-4.x) ship 200k.
  // Kept as a map so future divergence (e.g. 1M-context variants) is one line.
  return CONTEXT_LIMITS[model] ?? CONTEXT_LIMITS.default;
}

type TurnEv = Extract<SessionEvent, { kind: "turn" }>;
type ToolEv = Extract<SessionEvent, { kind: "tool_use" }>;

export type WindowPressureResult = {
  windowPressure: number[];
  maxWindowPressure: number;
  maxPressureTurn: number; // index into windowPressure; -1 if no turns
  findings: AntiPatternFinding[];
};

export function deriveWindowPressure(parsed: ParsedSession): WindowPressureResult {
  const turns = parsed.events.filter(
    (e): e is TurnEv => e.kind === "turn",
  );

  const windowPressure: number[] = [];
  let maxWindowPressure = 0;
  let maxPressureTurn = -1;
  let maxPressureModel = "unknown";
  let maxPressureLimit = 200_000;

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const limit = contextLimitFor(t.model);
    const promptTokens = t.usage.input + t.usage.cacheRead + t.usage.cacheCreate;
    const pressure = limit > 0 ? promptTokens / limit : 0;
    windowPressure.push(pressure);
    if (pressure > maxWindowPressure) {
      maxWindowPressure = pressure;
      maxPressureTurn = i;
      maxPressureModel = t.model;
      maxPressureLimit = limit;
    }
  }

  const findings: AntiPatternFinding[] = [];

  // Compaction recommendation: single badge keyed off peak pressure.
  if (maxWindowPressure >= COMPACTION_THRESHOLD && maxPressureTurn >= 0) {
    const pct = Math.round(maxWindowPressure * 100);
    findings.push({
      kind: "should_have_compacted",
      label: `turn ${maxPressureTurn + 1}`,
      detail: `${pct}% of ${maxPressureLimit.toLocaleString()} token window`,
      turnUuids: [turns[maxPressureTurn].uuid],
      compactionDetail: {
        atTurn: maxPressureTurn,
        pressurePct: pct,
        model: maxPressureModel,
        contextLimit: maxPressureLimit,
      },
    });
  }

  // Lost-in-middle: large tool outputs whose final position in the cumulative
  // prompt sits in the [0.3, 0.7] band — likely demoted to the attention dead zone.
  findings.push(...detectLostInMiddle(parsed.events));

  return { windowPressure, maxWindowPressure, maxPressureTurn, findings };
}

function detectLostInMiddle(events: SessionEvent[]): AntiPatternFinding[] {
  type Record = {
    tool: ToolEv;
    offsetAfter: number; // cumulative bytes including this tool's result
    sizeBytes: number;
  };
  const records: Record[] = [];
  let cum = 0;
  for (const e of events) {
    const before = cum;
    cum += eventByteSize(e);
    if (e.kind === "tool_use") {
      const size = cum - before;
      if (size >= LIM_MIN_KB * 1024) {
        records.push({ tool: e, offsetAfter: cum, sizeBytes: size });
      }
    }
  }
  const total = cum;
  if (total <= 0) return [];

  const out: AntiPatternFinding[] = [];
  for (const r of records) {
    const pos = r.offsetAfter / total;
    if (pos < LIM_LO || pos > LIM_HI) continue;
    const sizeKB = +(r.sizeBytes / 1024).toFixed(1);
    const positionPct = Math.round(pos * 100);
    out.push({
      kind: "lost_in_middle",
      label: `${r.tool.name} · ${inputLabel(r.tool)}`,
      detail: `${sizeKB} kB at ${positionPct}% of prompt`,
      turnUuids: [r.tool.parentTurn],
      lostInMiddleDetail: {
        toolName: r.tool.name,
        inputSummary: inputLabel(r.tool),
        sizeKB,
        positionPct,
      },
    });
  }
  return out;
}

function eventByteSize(e: SessionEvent): number {
  switch (e.kind) {
    case "turn":
      return e.text.length;
    case "user_prompt":
      return e.text.length;
    case "tool_use":
      return (
        (e.resultPreview?.length ?? 0) +
        safeJsonLen(e.input)
      );
    case "hook":
      return e.content.length;
    default:
      return 0;
  }
}

function safeJsonLen(x: unknown): number {
  try {
    return JSON.stringify(x ?? {}).length;
  } catch {
    return 0;
  }
}

function inputLabel(tu: ToolEv): string {
  const inp = (tu.input ?? {}) as Record<string, unknown>;
  const path = inp.file_path ?? inp.path ?? inp.notebook_path;
  if (typeof path === "string") return path;
  const cmd = inp.command;
  if (typeof cmd === "string") return cmd.slice(0, 80);
  const pattern = inp.pattern;
  if (typeof pattern === "string") return `/${pattern}/`;
  return "";
}
