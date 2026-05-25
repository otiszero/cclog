"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCost, formatTokens } from "@/lib/format";

const COLORS = [
  "var(--accent)",
  "var(--warning)",
  "var(--positive)",
  "var(--danger)",
  "#a855f7",
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
];

export function ModelDonut({
  data,
}: {
  data: { model: string; tokens: number; cost: number }[];
}) {
  if (data.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>No usage data yet.</p>;
  }

  const totalTokens = data.reduce((acc, d) => acc + d.tokens, 0);
  const totalCost = data.reduce((acc, d) => acc + d.cost, 0);
  // Sort descending so the legend reads largest → smallest; keep colors aligned.
  const sorted = [...data]
    .map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.tokens - a.tokens);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="shrink-0" style={{ width: 180, height: 180 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={sorted}
              dataKey="tokens"
              nameKey="model"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
            >
              {sorted.map((d, i) => (
                <Cell key={i} fill={d.color} stroke="var(--card)" />
              ))}
            </Pie>
            <Tooltip
              formatter={((v: unknown, _n: unknown, p: { payload?: { model?: string } }) =>
                [formatTokens(Number(v)), p?.payload?.model ?? ""]) as never}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full flex flex-col gap-1.5 text-xs min-w-0">
        {sorted.map((d) => {
          const share = totalTokens > 0 ? (d.tokens / totalTokens) * 100 : 0;
          return (
            <li
              key={d.model}
              className="grid items-center gap-2 min-w-0"
              style={{ gridTemplateColumns: "10px minmax(0,1fr) auto auto auto" }}
            >
              <span
                aria-hidden
                className="inline-block rounded-sm"
                style={{ width: 10, height: 10, background: d.color }}
              />
              <span className="truncate font-medium min-w-0" title={d.model}>
                {shortenModel(d.model)}
              </span>
              <span className="num tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                {share.toFixed(1)}%
              </span>
              <span className="num tabular-nums">{formatTokens(d.tokens)}</span>
              <span
                className="num tabular-nums"
                style={{ color: "var(--foreground-muted)", minWidth: 52, textAlign: "right" }}
              >
                {formatCost(d.cost)}
              </span>
            </li>
          );
        })}
        <li
          className="grid items-center gap-2 pt-1.5 mt-0.5 border-t min-w-0"
          style={{
            gridTemplateColumns: "10px minmax(0,1fr) auto auto auto",
            borderColor: "var(--border)",
            color: "var(--foreground-muted)",
          }}
        >
          <span />
          <span className="uppercase tracking-wider" style={{ fontSize: 10 }}>
            Total
          </span>
          <span />
          <span className="num tabular-nums">{formatTokens(totalTokens)}</span>
          <span className="num tabular-nums" style={{ minWidth: 52, textAlign: "right" }}>
            {formatCost(totalCost)}
          </span>
        </li>
      </ul>
    </div>
  );
}

// Strip trailing -YYYYMMDD date stamps (full name kept in tooltip).
function shortenModel(name: string): string {
  return name.replace(/-\d{8}$/, "");
}
