"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCost } from "@/lib/format";

export type ProjectsCostBar = {
  name: string;
  cost: number;
  slug: string;
};

export function ProjectsCostBarChart({ data }: { data: ProjectsCostBar[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCost(v as number)}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            formatter={((v: unknown) => formatCost(Number(v))) as never}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            cursor={{ fill: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
            labelStyle={{ color: "var(--foreground-muted)", marginBottom: 4 }}
          />
          <Bar dataKey="cost" fill="var(--accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
