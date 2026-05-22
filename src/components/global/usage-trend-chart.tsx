"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCost, formatTokens } from "@/lib/format";

export function UsageTrendChart({
  data,
}: {
  data: { date: string; tokens: number; cost: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatTokens(v as number)}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatCost(v as number)}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            formatter={((v: unknown, key: unknown) =>
              key === "cost" ? formatCost(Number(v)) : formatTokens(Number(v))) as never}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
            labelStyle={{ color: "var(--foreground-muted)", marginBottom: 4 }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="tokens"
            stroke="var(--accent)"
            fill="url(#tokenFill)"
            strokeWidth={2}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cost"
            stroke="var(--warning)"
            fill="transparent"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
