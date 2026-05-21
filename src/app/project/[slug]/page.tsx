import Link from "next/link";
import { aggregateProject } from "@/lib/parser/aggregate-project";
import { KpiCard } from "@/components/common/kpi-card";
import { LeaderboardCard } from "@/components/project/leaderboard-card";
import { UsageTrendChart } from "@/components/global/usage-trend-chart";
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Sessions" value={String(p.sessionCount)} />
        <KpiCard label="Tokens" value={formatTokens(sumTokens(p.lifetimeTokens))} />
        <KpiCard label="Est. cost" value={formatCost(p.estCostUsd)} />
        <KpiCard label="Last active" value={formatRelative(p.lastActive)} />
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
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {p.sessions.map((s) => (
                <tr key={s.sessionId}>
                  <td>{formatRelative(s.startedAt)}</td>
                  <td className="truncate max-w-[260px]" title={s.models.join(", ")}>
                    {s.models.join(", ") || "—"}
                  </td>
                  <td className="text-right">{s.turnCount}</td>
                  <td className="text-right">{formatTokens(sumTokens(s.totalTokens))}</td>
                  <td className="text-right">{formatCost(s.estCostUsd)}</td>
                  <td>
                    <Link
                      href={`/project/${encodeURIComponent(p.slug)}/session/${s.sessionId}`}
                      className="font-mono text-xs"
                    >
                      {s.sessionId.slice(0, 8)}…
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
