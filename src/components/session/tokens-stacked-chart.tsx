"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTokens } from "@/lib/format";

export function TokensStackedChart({
  data,
}: {
  data: { idx: number; input: number; output: number; cacheRead: number; cacheCreate: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis
            tickFormatter={(v) => formatTokens(v as number)}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            formatter={((v: unknown) => formatTokens(Number(v))) as never}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="cacheRead" stackId="a" fill="#0ea5e9" name="cache-read" />
          <Bar dataKey="cacheCreate" stackId="a" fill="#6366f1" name="cache-write" />
          <Bar dataKey="input" stackId="a" fill="var(--warning)" name="input" />
          <Bar dataKey="output" stackId="a" fill="var(--positive)" name="output" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
