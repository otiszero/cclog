import Link from "next/link";
import { aggregateProject } from "@/lib/parser/aggregate-project";
import { KpiCard } from "@/components/common/kpi-card";
import { LeaderboardCard } from "@/components/project/leaderboard-card";
import { HarnessPanel } from "@/components/project/harness-panel";
import { StartupContextPanel } from "@/components/project/startup-context-panel";
import { aggregateStartupContext } from "@/lib/parser/aggregate-startup-context";
import { UsageTrendChart } from "@/components/global/usage-trend-chart";
import { EfficiencyBadge } from "@/components/session/efficiency-card";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";
import { sumTokens } from "@/lib/parser/derive-metrics";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const p = await aggregateProject(decoded);
  const startupContext = await aggregateStartupContext(decoded, p.realPath);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/" className="text-xs" style={{ color: "var(--muted)" }}>
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 truncate" title={p.realPath}>
          {p.realPath}
        </h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {p.slug}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Sessions" value={String(p.sessionCount)} />
        <KpiCard label="Tokens" value={formatTokens(sumTokens(p.lifetimeTokens))} />
        <KpiCard label="Est. cost" value={formatCost(p.estCostUsd)} />
        <KpiCard label="Last active" value={formatRelative(p.lastActive)} />
        <KpiCard
          label="Efficiency"
          value={p.efficiency.grade}
          sub={p.efficiency.grade === "N/A" ? "—" : `${p.efficiency.score}/100 · token-weighted`}
        />
        <KpiCard
          label="Wasted ~$"
          value={formatCost(p.efficiency.wastedCostUsd)}
          sub={`upper bound: ${formatCost(p.efficiency.wastedCostUpperUsd)}`}
        />
      </section>

      {p.dailyTokens.length > 0 ? (
        <section className="card">
          <h3 className="text-sm font-semibold mb-2">Usage over time</h3>
          <UsageTrendChart data={p.dailyTokens} />
        </section>
      ) : null}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeaderboardCard
          title="Tools"
          rows={p.byTool}
          emptyHint="No raw tool calls recorded."
        />
        <LeaderboardCard
          title="Sub-agents"
          rows={p.bySubAgent}
          emptyHint="No sub-agent spawns yet."
        />
        <LeaderboardCard
          title="MCP servers"
          rows={p.byMcp}
          emptyHint="No MCP tool calls."
        />
        <LeaderboardCard
          title="Skills"
          rows={p.bySkill}
          emptyHint="No skill invocations."
        />
      </section>

      <HarnessPanel report={p.harness} />

      <StartupContextPanel context={startupContext} />

      <section className="card">
        <h3 className="text-sm font-semibold mb-3">Sessions</h3>
        {p.sessions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>No sessions found.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Started</th>
                <th>Models</th>
                <th className="text-right">Turns</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Cost</th>
                <th className="text-right" title="z-score of cost vs project mean">Anom.</th>
                <th className="text-right" title="Risky tool calls">Risk</th>
                <th className="text-right">Wasted</th>
                <th className="text-center">Eff.</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {p.sessions.map((s) => {
                const z = s.costAnomalyZ;
                const zColor =
                  z != null && z >= 2 ? "#ef4444" : z != null && z >= 1 ? "var(--warning)" : undefined;
                return (
                  <tr key={s.sessionId}>
                    <td>{formatRelative(s.startedAt)}</td>
                    <td className="truncate max-w-[260px]" title={s.models.join(", ")}>
                      {s.models.join(", ") || "—"}
                    </td>
                    <td className="text-right">{s.turnCount}</td>
                    <td className="text-right">{formatTokens(sumTokens(s.totalTokens))}</td>
                    <td className="text-right">{formatCost(s.estCostUsd)}</td>
                    <td
                      className="text-right num"
                      style={{ color: zColor }}
                      title={
                        z == null
                          ? "Not enough sessions to compute"
                          : `z = ${z.toFixed(2)} vs project mean`
                      }
                    >
                      {z == null ? "—" : `${z >= 0 ? "+" : ""}${z.toFixed(1)}σ`}
                    </td>
                    <td
                      className="text-right num"
                      style={{ color: s.riskHitCount > 0 ? "var(--warning)" : undefined }}
                      title="Risky tool calls (destructive bash / sensitive read / etc.)"
                    >
                      {s.riskHitCount || "—"}
                    </td>
                    <td
                      className="text-right num"
                      title={`Marginal: ${formatCost(s.efficiency.wastedCostUsd)}\nUpper bound (no cache): ${formatCost(s.efficiency.wastedCostUpperUsd)}`}
                      style={{
                        color: s.efficiency.wastedCostUsd > 0.5 ? "#ef4444" : undefined,
                      }}
                    >
                      {s.efficiency.wastedCostUsd > 0
                        ? formatCost(s.efficiency.wastedCostUsd)
                        : "—"}
                    </td>
                    <td className="text-center">
                      <EfficiencyBadge grade={s.efficiency.grade} score={s.efficiency.score} />
                    </td>
                    <td>
                      <Link
                        href={`/project/${encodeURIComponent(p.slug)}/session/${s.sessionId}`}
                        className="font-mono text-xs"
                      >
                        {s.sessionId.slice(0, 8)}…
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
