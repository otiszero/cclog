import { aggregateGlobal } from "@/lib/parser/aggregate-global";
import { formatCost, formatTokens } from "@/lib/format";
import { sumTokens } from "@/lib/parser/derive-metrics";
import {
  ProjectsExplorer,
  type ProjectRow,
} from "@/components/projects/projects-explorer";
import {
  ProjectsCostBarChart,
  type ProjectsCostBar,
} from "@/components/projects/projects-cost-bar-chart";

export const dynamic = "force-dynamic";

const TOP_N = 10;

export default async function ProjectsPage() {
  const g = await aggregateGlobal();
  const projects = g.allProjects;
  // Server-rendered on demand; capture request-time clock for activity windows.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const rows: ProjectRow[] = projects.map((p) => {
    const modelSet = new Set<string>();
    for (const s of p.sessions) for (const m of s.models) modelSet.add(m);
    return {
      slug: p.slug,
      realPath: p.realPath,
      sessionCount: p.sessionCount,
      tokens: sumTokens(p.lifetimeTokens),
      cost: p.estCostUsd,
      lastActive: p.lastActive,
      lastActiveMs: p.lastActive ? new Date(p.lastActive).getTime() : 0,
      models: [...modelSet].sort(),
    };
  });

  const allModels = [...new Set(rows.flatMap((r) => r.models))].sort();

  const totalSessions = rows.reduce((acc, r) => acc + r.sessionCount, 0);
  const totalTokens = rows.reduce((acc, r) => acc + r.tokens, 0);
  const totalCost = rows.reduce((acc, r) => acc + r.cost, 0);

  const topByCost: ProjectsCostBar[] = [...rows]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, TOP_N)
    .map((r) => ({
      slug: r.slug,
      name: shortName(r.realPath),
      cost: r.cost,
    }))
    .reverse(); // bar chart vertical layout reads bottom→top

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">All projects</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {rows.length} project{rows.length === 1 ? "" : "s"} under{" "}
          <code>~/.claude/projects</code>.
        </p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Projects" value={String(rows.length)} />
        <KpiCard label="Sessions" value={String(totalSessions)} />
        <KpiCard label="Total tokens" value={formatTokens(totalTokens)} />
        <KpiCard label="Estimated cost" value={formatCost(totalCost)} />
      </div>

      {/* Chart dashboard */}
      {topByCost.length > 0 && (
        <div className="card">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Top projects by cost
            </h2>
            <span
              className="text-[11px]"
              style={{ color: "var(--foreground-muted)" }}
            >
              Top {Math.min(TOP_N, rows.length)} · estimated $USD
            </span>
          </div>
          <ProjectsCostBarChart data={topByCost} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No projects yet. Start a Claude Code session in some directory and refresh.
          </p>
        </div>
      ) : (
        <ProjectsExplorer rows={rows} models={allModels} nowMs={nowMs} />
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function shortName(realPath: string): string {
  const parts = realPath.split("/").filter(Boolean);
  if (parts.length <= 2) return realPath;
  return ".../" + parts.slice(-2).join("/");
}
