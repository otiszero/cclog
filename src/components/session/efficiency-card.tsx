"use client";
import { useState } from "react";
import type {
  AntiPatternFinding,
  EfficiencyGrade,
  EfficiencyReport,
  ReReadReason,
} from "@/lib/types";
import { formatCost } from "@/lib/format";
import { PRICING_AS_OF } from "@/lib/pricing";

const GRADE_COLOR: Record<EfficiencyGrade, string> = {
  A: "var(--positive)",
  B: "var(--positive)",
  C: "var(--warning)",
  D: "var(--warning)",
  F: "#ef4444",
  "N/A": "var(--muted)",
};

const KIND_LABEL: Record<AntiPatternFinding["kind"], string> = {
  re_grep_loop: "Re-read loop",
  tool_output_explosion: "Big tool output",
  retry_loop: "Retry loop",
  flailing_edit: "Flailing edits",
  lost_in_middle: "Lost in middle",
  should_have_compacted: "Should have compacted",
};

const REASON_LABEL: Record<ReReadReason, string> = {
  first_read: "first read",
  duplicate_same_batch: "duplicate in same batch",
  re_verify_after_edit: "re-verify after Edit/Write",
  after_sub_agent: "context lost after sub-agent",
  context_drift: "context drift (many turns since last read)",
  unknown: "unclear",
};

const REASON_HINT: Record<ReReadReason, string> = {
  first_read: "Initial read — necessary, not counted as waste.",
  duplicate_same_batch:
    "Same file requested twice within one assistant turn — batch confusion, agent forgot it just queued the read.",
  re_verify_after_edit:
    "Agent edited the file then re-read it to confirm changes. Often unnecessary — Edit returns the patched chunk.",
  after_sub_agent:
    "A sub-agent (Task) ran between the reads. Sub-agents have isolated context; parent re-reads to recover state.",
  context_drift:
    "Many turns passed since the previous read. Earlier read may have aged out of working memory or been compacted.",
  unknown:
    "No edit, sub-agent, or large gap between reads — likely the agent simply forgot it already read the file.",
};

const SCORING_EXPLAIN = `Efficiency = weighted score from 3 metrics:

• Cache hit rate (40 pts) — cacheRead / (cacheRead + input + cacheCreate).
  Cached input costs ~10% of fresh input. Goal ≥ 90%.

• Re-read waste (30 pts) — repeated Read calls / total Read calls.
  First read is necessary; any further read of the same file is waste. Bad > 30%.

• Tool bloat (30 pts) — tool calls returning ≥ 10kB / total tool calls.
  Large tool results sit in cache for all subsequent turns. Bad > 20%.

Letter: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60. N/A if session has < 3 turns.

Project grade = token-weighted average of session scores (big sessions count more).`;

export function EfficiencyCard({ report }: { report: EfficiencyReport }) {
  const [open, setOpen] = useState(false);
  const color = GRADE_COLOR[report.grade];

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center rounded-md font-mono font-bold"
            style={{
              color,
              borderColor: color,
              border: "2px solid",
              width: 44,
              height: 44,
              fontSize: 22,
            }}
            title={
              report.grade === "N/A"
                ? "Not enough turns to grade"
                : `Efficiency score ${report.score}/100`
            }
          >
            {report.grade}
          </span>
          <div className="flex flex-col">
            <span className="kpi-label inline-flex items-center gap-1">
              Efficiency
              <InfoIcon title={SCORING_EXPLAIN} />
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {report.grade === "N/A"
                ? "session too short to grade"
                : `${report.score}/100 · ${report.findings.length} flag${
                    report.findings.length === 1 ? "" : "s"
                  }`}
            </span>
          </div>
        </div>
        <div className="flex gap-4 ml-auto flex-wrap text-sm">
          <Metric
            label="Cache hit"
            value={pct(report.cacheHitRate)}
            ok={report.cacheHitRate >= 0.5}
            hint={`cacheRead / (cacheRead + input + cacheCreate).\nCached input is ~10% the cost of fresh.\nGoal ≥ 90%, bad < 50%.`}
          />
          <Metric
            label="Re-read waste"
            value={report.totalReads === 0 ? "—" : pct(report.reReadWaste)}
            ok={report.reReadWaste <= 0.3 || report.totalReads === 0}
            hint={`Repeated Read calls / total Read calls.\n>30% means agent kept re-reading same files.\n${report.totalReads} reads total.`}
          />
          <Metric
            label="Tool bloat"
            value={report.totalTools === 0 ? "—" : pct(report.toolBloat)}
            ok={report.toolBloat <= 0.2 || report.totalTools === 0}
            hint={`Tool calls returning ≥10kB / total.\n>20% means unfiltered output contaminating context.\n${report.totalTools} tools tracked.`}
          />
          <Metric
            label="Wasted ~$"
            value={formatCost(report.wastedCostUsd)}
            ok={report.wastedCostUsd < 0.5}
            hint={`Estimated extra USD this session spent on re-reads + bloated tool outputs.\n\nMarginal (cache-aware): ${formatCost(report.wastedCostUsd)}\n  • re-reads: ${formatCost(report.wastedCostBreakdown.reReadUsd)}\n  • bloat: ${formatCost(report.wastedCostBreakdown.bloatUsd)}\n\nUpper bound (if no cache): ${formatCost(report.wastedCostUpperUsd)}\n\nPriced per actual turn's model · rates as of ${PRICING_AS_OF}.\nResult bytes are capped at 200kB by the parser — very large reads may be undercount.`}
          />
        </div>
        {report.findings.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="tag"
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
          >
            {open ? "Hide" : "Show"} findings
          </button>
        ) : null}
      </div>

      {report.maxWindowPressure >= 0.8 && report.maxPressureTurn >= 0 ? (
        <CompactionBadge
          turn={report.maxPressureTurn}
          pressurePct={Math.round(report.maxWindowPressure * 100)}
        />
      ) : null}

      {open && report.findings.length > 0 ? (
        <div
          className="flex flex-col gap-3 pt-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {report.findings.map((f, i) => (
            <FindingBlock key={`${f.kind}-${i}`} f={f} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FindingBlock({ f }: { f: AntiPatternFinding }) {
  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded border"
      style={{
        borderColor: "color-mix(in srgb, #ef4444 40%, var(--border))",
        background: "color-mix(in srgb, #ef4444 4%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span
          className="tag shrink-0"
          style={{ color: "#ef4444", borderColor: "#ef4444" }}
        >
          {KIND_LABEL[f.kind]}
        </span>
        <span className="font-mono truncate" title={f.label}>
          {f.label}
        </span>
        <span className="ml-auto" style={{ color: "var(--muted)" }}>
          {f.detail}
        </span>
      </div>
      {f.reReadDetail ? <ReReadDetailView d={f.reReadDetail} /> : null}
      {f.bloatDetail ? <BloatDetailView d={f.bloatDetail} /> : null}
      {f.lostInMiddleDetail ? <LostInMiddleDetailView d={f.lostInMiddleDetail} /> : null}
      {f.compactionDetail ? <CompactionDetailView d={f.compactionDetail} /> : null}
    </div>
  );
}

function CompactionBadge({ turn, pressurePct }: { turn: number; pressurePct: number }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
      style={{
        background: "color-mix(in srgb, #ef4444 8%, transparent)",
        border: "1px solid color-mix(in srgb, #ef4444 40%, var(--border))",
        color: "#ef4444",
      }}
      title="Window pressure crossed 80% — manual /compact (or restarting the session) would have reclaimed context for the rest of the conversation."
    >
      <span>⚠</span>
      <span>
        <strong>Should have compacted</strong> at turn {turn + 1} ({pressurePct}% of 200k window
        full)
      </span>
    </div>
  );
}

function LostInMiddleDetailView({
  d,
}: {
  d: NonNullable<AntiPatternFinding["lostInMiddleDetail"]>;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-mono break-all" style={{ color: "var(--muted)" }}>
        {d.toolName} · {d.inputSummary}
      </div>
      <ul className="list-disc pl-5 flex flex-col gap-0.5">
        <li>
          Result size: <strong>{d.sizeKB.toFixed(1)} kB</strong>
        </li>
        <li>
          Sits at <strong>{d.positionPct}%</strong> of the cumulative prompt — middle of the
          context window, where LLM attention is weakest (lost-in-the-middle effect).
        </li>
      </ul>
      <p className="text-xs italic" style={{ color: "var(--muted)" }}>
        Tip: summarise or compact early. Large outputs in the middle of the prompt may be
        effectively ignored even though they cost cache tokens.
      </p>
    </div>
  );
}

function CompactionDetailView({
  d,
}: {
  d: NonNullable<AntiPatternFinding["compactionDetail"]>;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <ul className="list-disc pl-5 flex flex-col gap-0.5">
        <li>
          Peak pressure: <strong>{d.pressurePct}%</strong> of {d.contextLimit.toLocaleString()}
          {" "}tokens ({d.model})
        </li>
        <li>Turn index: {d.atTurn + 1}</li>
      </ul>
      <p className="text-xs italic" style={{ color: "var(--muted)" }}>
        Tip: run <span className="font-mono">/compact</span> when the window crosses ~80%.
        Past that point new context displaces old context and the model starts forgetting earlier
        decisions.
      </p>
    </div>
  );
}

function ReReadDetailView({ d }: { d: NonNullable<AntiPatternFinding["reReadDetail"]> }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-mono break-all" style={{ color: "var(--muted)" }}>
        {d.filePath}
      </div>
      <table className="data text-xs">
        <thead>
          <tr>
            <th className="text-left">#</th>
            <th className="text-left">Time</th>
            <th className="text-left">Likely cause</th>
            <th className="text-right">Size</th>
            <th className="text-right">Extra cost</th>
          </tr>
        </thead>
        <tbody>
          {d.reads.map((r, i) => (
            <tr key={i}>
              <td className="num">{i + 1}</td>
              <td className="num">{r.ts ? new Date(r.ts).toLocaleTimeString() : "—"}</td>
              <td>
                <span title={REASON_HINT[r.reason]}>
                  {REASON_LABEL[r.reason]}
                  {r.reason === "first_read" ? " (necessary)" : " ⚠"}
                </span>
              </td>
              <td className="num text-right">
                {r.chars > 0 ? `${(r.chars / 1024).toFixed(1)}kB` : "—"}
              </td>
              <td
                className="num text-right"
                title={
                  r.reason === "first_read"
                    ? "Initial read — not waste."
                    : `Marginal: ${formatCost(r.wastedCostUsd)}\nUpper bound (no cache): ${formatCost(r.wastedCostUpperUsd)}`
                }
              >
                {r.reason === "first_read" ? "—" : `+${formatCost(r.wastedCostUsd)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs italic" style={{ color: "var(--muted)" }}>
        Tip: keep the first read in context and reference by line numbers instead of re-reading.
      </p>
    </div>
  );
}

function BloatDetailView({ d }: { d: NonNullable<AntiPatternFinding["bloatDetail"]> }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-mono break-all" style={{ color: "var(--muted)" }}>
        {d.toolName} · {d.inputSummary}
      </div>
      <ul className="list-disc pl-5 flex flex-col gap-0.5">
        <li>
          Result size: <strong>{(d.resultChars / 1024).toFixed(1)} kB</strong> (~
          {formatN(d.estTokens)} tokens, chars/4 estimate)
        </li>
        <li>
          Stayed in context for <strong>{d.turnsAfter}</strong> following turn
          {d.turnsAfter === 1 ? "" : "s"} via cached input
        </li>
        <li>
          Estimated extra cached tokens carried:{" "}
          <strong>~{formatN(d.estCarriedTokens)}</strong>
          <span style={{ color: "var(--muted)" }}>
            {" "}
            ({formatN(d.estTokens)} × {d.turnsAfter})
          </span>
        </li>
        <li>
          Marginal cost: <strong>{formatCost(d.wastedCostUsd)}</strong>
          <span style={{ color: "var(--muted)" }}>
            {" "}
            (upper bound without cache: {formatCost(d.wastedCostUpperUsd)} · model: {d.model})
          </span>
        </li>
      </ul>
      <p className="text-xs italic" style={{ color: "var(--muted)" }}>
        Impact: large outputs get added to the prompt cache and re-loaded on every
        subsequent turn. Filter the output (head/tail/grep), capture exit code only,
        or stream to a file instead of returning to the agent.
      </p>
    </div>
  );
}

export function EfficiencyBadge({
  grade,
  score,
  size = "sm",
}: {
  grade: EfficiencyGrade;
  score: number;
  size?: "sm" | "md";
}) {
  const color = GRADE_COLOR[grade];
  const dim = size === "md" ? 28 : 22;
  return (
    <span
      className="inline-flex items-center justify-center rounded font-mono font-bold"
      style={{
        color,
        borderColor: color,
        border: "1.5px solid",
        width: dim,
        height: dim,
        fontSize: size === "md" ? 13 : 11,
      }}
      title={grade === "N/A" ? "Not graded (too few turns)" : `Efficiency ${score}/100`}
    >
      {grade}
    </span>
  );
}

function Metric({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: string;
  ok: boolean;
  hint: string;
}) {
  const color = ok ? "var(--positive)" : "#ef4444";
  return (
    <div className="flex flex-col">
      <span className="kpi-label inline-flex items-center gap-1">
        {label}
        <InfoIcon title={hint} />
      </span>
      <span className="font-mono text-base" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function InfoIcon({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="info"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full cursor-help"
        style={{
          width: 14,
          height: 14,
          border: "1px solid var(--muted)",
          color: "var(--muted)",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          background: "transparent",
        }}
      >
        i
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute z-20 left-1/2 top-full mt-1.5 -translate-x-1/2 rounded-md px-3 py-2 text-xs whitespace-pre-line shadow-lg"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            minWidth: 240,
            maxWidth: 380,
            fontWeight: 400,
            pointerEvents: "none",
          }}
        >
          {title}
        </span>
      ) : null}
    </span>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function formatN(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
