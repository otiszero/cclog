import { KpiCard } from "@/components/common/kpi-card";
import type { ActivityStats } from "@/lib/types";

function formatSpan(from: number, to: number): string {
  if (!from || !to) return "—";
  const days = Math.max(1, Math.round((to - from) / 86_400_000));
  return `${days}d`;
}

// Top-line counts derived from history.jsonl.
export function ActivityKpiStrip({ stats }: { stats: ActivityStats }) {
  const span = formatSpan(stats.dateRange.from, stats.dateRange.to);
  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard label="Entries" value={String(stats.totalEntries)} />
      <KpiCard label="Commands" value={String(stats.commandCount)} />
      <KpiCard label="Prompts" value={String(stats.promptCount)} />
      <KpiCard label="Distinct commands" value={String(stats.commandLeaderboard.length)} />
      <KpiCard label="History span" value={span} sub={`${stats.skipped} skipped`} />
    </section>
  );
}
