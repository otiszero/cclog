"use client";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActivityStats } from "@/lib/types";

const TOP_N = 20;

// Color bars by command namespace so ck-stack vs builtin commands read at a glance.
function colorFor(namespace?: string): string {
  if (!namespace) return "var(--foreground-subtle)"; // builtin (/clear, /model…)
  if (namespace === "ck") return "var(--accent)";
  return "var(--warning)"; // other namespaces
}

export function CommandLeaderboard({
  rows,
}: {
  rows: ActivityStats["commandLeaderboard"];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No commands recorded yet.
      </p>
    );
  }

  const shown = rows.slice(0, TOP_N);
  const hidden = rows.length - shown.length;
  // taller chart when more bars so labels stay legible
  const height = Math.max(220, shown.length * 22);

  return (
    <div className="flex flex-col gap-2">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={shown}
            margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="command"
              width={110}
              tick={{ fontSize: 11, fill: "var(--foreground-muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--border)", opacity: 0.3 }}
              formatter={((v: unknown) => [String(v), "uses"]) as never}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
              {shown.map((r, i) => (
                <Cell key={i} fill={colorFor(r.namespace)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hidden > 0 ? (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          +{hidden} more commands not shown
        </p>
      ) : null}
    </div>
  );
}
