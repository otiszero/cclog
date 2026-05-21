import Link from "next/link";
import { aggregateGlobal } from "@/lib/parser/aggregate-global";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";
import { sumTokens } from "@/lib/parser/derive-metrics";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const g = await aggregateGlobal();
  const projects = g.allProjects;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">All projects</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {projects.length} project{projects.length === 1 ? "" : "s"} under{" "}
          <code>~/.claude/projects</code>, sorted by most recent activity.
        </p>
      </header>

      <div className="card">
        {projects.length === 0 ? (
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
              {projects.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <Link
                      href={`/project/${encodeURIComponent(p.slug)}`}
                      className="truncate block max-w-[520px]"
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
    </div>
  );
}
