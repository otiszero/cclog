"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatTokens } from "@/lib/format";

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
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="tokens"
            nameKey="model"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--card)" />
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
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
