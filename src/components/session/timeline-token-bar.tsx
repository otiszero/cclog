"use client";
import { useState } from "react";
import type { TokenUsage } from "@/lib/types";
import { formatTokens, formatCost } from "@/lib/format";
import { resolvePricing } from "@/lib/pricing";

// Match palette of TokensStackedChart so users can cross-reference both views.
export const TOKEN_COLORS = {
  cacheRead: "#0ea5e9",
  cacheCreate: "#6366f1",
  input: "var(--warning)",
  output: "var(--positive)",
} as const;

type Props = {
  usage: TokenUsage;
  model: string;
  // scale for the "context" bar (full total incl cacheRead)
  maxTotal: number;
  // scale for the "work" bar (output + cacheCreate only)
  maxWork: number;
};

type TooltipRow = { label: string; value: number; color: string; cost: number };

// Two stacked-segment bars per turn:
//   Context bar — full token mix; cacheRead dominates late-session turns by design.
//   Work bar    — only "new" tokens (output + cacheCreate); reflects how much the
//                 turn actually produced. This is the metric to scan for "heavy" turns.
export function TimelineTokenBar({ usage, model, maxTotal, maxWork }: Props) {
  const total = usage.input + usage.output + usage.cacheRead + usage.cacheCreate;
  const work = usage.output + usage.cacheCreate;

  const seg = (n: number, denom: number) =>
    denom > 0 ? `${Math.max(0, (n / denom) * 100)}%` : "0%";

  const contextWidth = maxTotal > 0 ? Math.min(100, (total / maxTotal) * 100) : 0;
  const workWidth = maxWork > 0 ? Math.min(100, (work / maxWork) * 100) : 0;

  const p = resolvePricing(model);
  const costOf = (tokens: number, rate: number | undefined) =>
    p && rate !== undefined ? (tokens * rate) / 1_000_000 : 0;

  const costCacheRead = costOf(usage.cacheRead, p?.cacheRead);
  const costCacheCreate = costOf(usage.cacheCreate, p?.cacheCreate5m);
  const costInput = costOf(usage.input, p?.input);
  const costOutput = costOf(usage.output, p?.output);

  const ctxRows: TooltipRow[] = [
    { label: "cache-read", value: usage.cacheRead, color: TOKEN_COLORS.cacheRead, cost: costCacheRead },
    { label: "cache-creation", value: usage.cacheCreate, color: TOKEN_COLORS.cacheCreate, cost: costCacheCreate },
    { label: "input", value: usage.input, color: TOKEN_COLORS.input, cost: costInput },
    { label: "output", value: usage.output, color: TOKEN_COLORS.output, cost: costOutput },
  ];

  const workRows: TooltipRow[] = [
    { label: "cache-creation", value: usage.cacheCreate, color: TOKEN_COLORS.cacheCreate, cost: costCacheCreate },
    { label: "output", value: usage.output, color: TOKEN_COLORS.output, cost: costOutput },
  ];

  const ctxCost = costCacheRead + costCacheCreate + costInput + costOutput;
  const workCost = costCacheCreate + costOutput;
  const hasPricing = !!p;

  return (
    <div className="flex flex-col gap-1 mt-1">
      <BarRow
        label="ctx"
        title="Context total"
        total={total}
        totalCost={ctxCost}
        hasPricing={hasPricing}
        rows={ctxRows}
        width={contextWidth}
        rightText={formatTokens(total)}
      >
        <Segment color={TOKEN_COLORS.cacheRead} width={seg(usage.cacheRead, total)} />
        <Segment color={TOKEN_COLORS.cacheCreate} width={seg(usage.cacheCreate, total)} />
        <Segment color={TOKEN_COLORS.input} width={seg(usage.input, total)} />
        <Segment color={TOKEN_COLORS.output} width={seg(usage.output, total)} />
      </BarRow>
      <BarRow
        label="work"
        title="Work total (output + cache-creation)"
        total={work}
        totalCost={workCost}
        hasPricing={hasPricing}
        rows={workRows}
        width={workWidth}
        rightText={formatTokens(work)}
      >
        <Segment color={TOKEN_COLORS.cacheCreate} width={seg(usage.cacheCreate, work)} />
        <Segment color={TOKEN_COLORS.output} width={seg(usage.output, work)} />
      </BarRow>
    </div>
  );
}

function BarRow({
  label,
  title,
  total,
  totalCost,
  hasPricing,
  rows,
  width,
  rightText,
  children,
}: {
  label: string;
  title: string;
  total: number;
  totalCost: number;
  hasPricing: boolean;
  rows: TooltipRow[];
  width: number;
  rightText: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="relative flex items-center gap-2"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        className="text-[10px] uppercase tracking-wider w-9 shrink-0"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full flex"
          style={{ width: `${width}%`, minWidth: width > 0 ? 2 : 0 }}
        >
          {children}
        </div>
      </div>
      <span
        className="text-[10px] tabular-nums w-12 text-right shrink-0"
        style={{ color: "var(--muted)" }}
      >
        {rightText}
      </span>

      {hover ? (
        <BarTooltip
          title={title}
          total={total}
          totalCost={totalCost}
          hasPricing={hasPricing}
          rows={rows}
        />
      ) : null}
    </div>
  );
}

function BarTooltip({
  title,
  total,
  totalCost,
  hasPricing,
  rows,
}: {
  title: string;
  total: number;
  totalCost: number;
  hasPricing: boolean;
  rows: TooltipRow[];
}) {
  return (
    <div
      className="absolute left-12 -top-2 -translate-y-full z-20 rounded-lg shadow-lg pointer-events-none"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 10px",
        minWidth: 240,
      }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-1.5">
        <span style={{ color: "var(--muted)" }}>{title}</span>
        <span className="tabular-nums font-medium">
          {formatTokens(total)}
          {hasPricing ? (
            <span className="ml-2" style={{ color: "var(--muted)" }}>
              {formatCost(totalCost)}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span
              className="inline-block rounded-sm shrink-0"
              style={{ width: 10, height: 10, background: r.color }}
            />
            <span className="flex-1" style={{ color: "var(--muted)" }}>
              {r.label}
            </span>
            <span className="tabular-nums">{formatTokens(r.value)}</span>
            <span
              className="tabular-nums text-right"
              style={{ color: "var(--muted)", width: 44 }}
            >
              {total > 0 ? `${((r.value / total) * 100).toFixed(1)}%` : "—"}
            </span>
            {hasPricing ? (
              <span
                className="tabular-nums text-right"
                style={{ width: 56 }}
              >
                {formatCost(r.cost)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Segment({ color, width }: { color: string; width: string }) {
  return <div style={{ width, background: color, height: "100%" }} />;
}
