import Link from "next/link";
import type { StartupContextSummary } from "@/lib/types";
import { formatTokens } from "@/lib/format";

const CAP = 40; // rows shown; remainder noted, never silently dropped

// Cross-project startup-context comparison. The shared base is constant across
// every project, so the differentiator (and the CSS bar) is total tokens, with
// the project-specific delta called out separately.
export function ContextComparisonTable({ summary }: { summary: StartupContextSummary }) {
  if (summary.projects.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No projects found.
      </p>
    );
  }

  const shown = summary.projects.slice(0, CAP);
  const hidden = summary.projects.length - shown.length;
  const max = Math.max(1, ...shown.map((p) => p.totalTokens));

  return (
    <div className="overflow-x-auto">
      <table className="data">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col" className="text-right num">
              Total tok
            </th>
            <th scope="col" className="text-right num">
              Project-specific
            </th>
            <th scope="col" style={{ width: "30%" }}>
              Relative
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => {
            const pct = Math.round((p.totalTokens / max) * 100);
            return (
              <tr key={p.slug}>
                <td>
                  <Link
                    href={`/project/${encodeURIComponent(p.slug)}`}
                    className="truncate block max-w-[360px]"
                  >
                    {p.realPath}
                  </Link>
                </td>
                <td className="text-right num">{formatTokens(p.totalTokens)}</td>
                <td className="text-right num" style={{ color: "var(--foreground-muted)" }}>
                  {p.projectTokens > 0 ? `+${formatTokens(p.projectTokens)}` : "—"}
                </td>
                <td>
                  <div
                    className="rounded-[2px]"
                    style={{
                      height: 8,
                      width: `${pct}%`,
                      minWidth: 2,
                      background: "var(--accent)",
                    }}
                    title={`${formatTokens(p.totalTokens)} tok`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hidden > 0 ? (
        <p className="mt-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
          +{hidden} more projects not shown
        </p>
      ) : null}
    </div>
  );
}
