import Link from "next/link";
import { aggregateGlobal } from "@/lib/parser/aggregate-global";
import { KpiCard } from "@/components/common/kpi-card";
import { UsageTrendChart } from "@/components/global/usage-trend-chart";
import { ModelDonut } from "@/components/global/model-donut";
import { LeaderboardCard } from "@/components/project/leaderboard-card";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";
import { sumTokens } from "@/lib/parser/derive-metrics";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const g = await aggregateGlobal();
  const totalTok = sumTokens(g.lifetimeTokens);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Global usage</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aggregate of every Claude Code session under <code>~/.claude/projects</code>.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Projects" value={String(g.totalProjects)} />
        <KpiCard label="Sessions" value={String(g.totalSessions)} />
        <KpiCard label="Tokens (lifetime)" value={formatTokens(totalTok)} />
        <KpiCard label="Est. cost" value={formatCost(g.estCostUsd)} />
        <KpiCard label="Avg cost/session" value={formatCost(g.avgCostPerSession)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-2">Last 30 days</h3>
          <UsageTrendChart data={g.daily} />
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-2">Tokens by model</h3>
          <ModelDonut data={g.byModel} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Top projects</h3>
          {g.topProjects.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No projects yet. Start a Claude Code session in some directory and refresh.
            </p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Project</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Tokens</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Last active</th>
                </tr>
              </thead>
              <tbody>
                {g.topProjects.map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <Link
                        href={`/project/${encodeURIComponent(p.slug)}`}
                        className="truncate block max-w-[420px]"
                      >
                        {p.realPath}
                      </Link>
                    </td>
                    <td className="text-right">{p.sessionCount}</td>
                    <td className="text-right">{formatTokens(sumTokens(p.lifetimeTokens))}</td>
                    <td className="text-right">{formatCost(p.estCostUsd)}</td>
                    <td className="text-right">{formatRelative(p.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <LeaderboardCard
          title="Top tools (global)"
          rows={g.topTools.map((t) => ({
            key: t.key,
            count: 0,
            tokens: { input: t.tokens, output: 0, cacheRead: 0, cacheCreate: 0 },
            estCostUsd: t.cost,
          }))}
          emptyHint="No tool usage recorded yet."
        />
      </section>
    </div>
  );
}
