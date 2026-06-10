import Link from "next/link";
import { aggregateGlobal } from "@/lib/parser/aggregate-global";
import { KpiCard } from "@/components/common/kpi-card";
import { UsageTrendChart } from "@/components/global/usage-trend-chart";
import { ModelDonut } from "@/components/global/model-donut";
import { LeaderboardCard } from "@/components/project/leaderboard-card";
import { EmptyState } from "@/components/common/empty-state";
import { EfficiencyBadge } from "@/components/session/efficiency-card";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";
import { sumTokens } from "@/lib/parser/derive-metrics";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const g = await aggregateGlobal();
  const totalTok = sumTokens(g.lifetimeTokens);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Global usage
        </h1>
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          Aggregate of every Claude Code session under{" "}
          <code className="font-mono text-xs">~/.claude/projects</code>.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
            <EmptyState
              title="No projects yet"
              hint="Start a Claude Code session in some directory and refresh this page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Project</th>
                    <th scope="col" className="text-right num">
                      Sessions
                    </th>
                    <th scope="col" className="text-right num">
                      Tokens
                    </th>
                    <th scope="col" className="text-right num">
                      Cost
                    </th>
                    <th scope="col" className="text-right num">
                      Wasted
                    </th>
                    <th scope="col" className="text-center">
                      Eff.
                    </th>
                    <th scope="col" className="text-right num">
                      Last active
                    </th>
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
                      <td className="text-right num">{p.sessionCount}</td>
                      <td className="text-right num">
                        {formatTokens(sumTokens(p.lifetimeTokens))}
                      </td>
                      <td className="text-right num">
                        {formatCost(p.estCostUsd)}
                      </td>
                      <td
                        className="text-right num"
                        title={`Marginal: ${formatCost(p.efficiency.wastedCostUsd)}\nUpper bound (no cache): ${formatCost(p.efficiency.wastedCostUpperUsd)}`}
                        style={{
                          color:
                            p.efficiency.wastedCostUsd > 0.5
                              ? "#ef4444"
                              : undefined,
                        }}
                      >
                        {p.efficiency.wastedCostUsd > 0
                          ? formatCost(p.efficiency.wastedCostUsd)
                          : "—"}
                      </td>
                      <td className="text-center">
                        <EfficiencyBadge
                          grade={p.efficiency.grade}
                          score={p.efficiency.score}
                        />
                      </td>
                      <td className="text-right num">
                        {formatRelative(p.lastActive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <LeaderboardCard
          title="Top tools (global)"
          rows={g.topTools.map((t) => ({
            key: t.key,
            count: t.count,
            tokens: { input: t.tokens, output: 0, cacheRead: 0, cacheCreate: 0 },
            estCostUsd: t.cost,
          }))}
          emptyHint="No tool usage recorded yet."
        />
      </section>
    </div>
  );
}
