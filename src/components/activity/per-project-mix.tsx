import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { projectsDir } from "@/lib/parser/claude-home";
import type { ActivityStats } from "@/lib/types";

// Per-project command mix. Rows deep-link to /project/[slug] only when a matching
// session dir exists under ~/.claude/projects; otherwise the project has history
// but no parsed sessions, so we show the raw path as plain text (no dead link).
export function PerProjectMix({
  rows,
  truncated,
}: {
  rows: ActivityStats["perProject"];
  truncated: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No per-project activity yet.
      </p>
    );
  }

  const dir = projectsDir();
  return (
    <div className="overflow-x-auto">
      <table className="data">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col" className="text-right num">
              Entries
            </th>
            <th scope="col">Top command</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const hasSession = existsSync(join(dir, p.slug));
            return (
              <tr key={p.slug}>
                <td>
                  {hasSession ? (
                    <Link
                      href={`/project/${encodeURIComponent(p.slug)}`}
                      className="truncate block max-w-[420px]"
                    >
                      {p.path}
                    </Link>
                  ) : (
                    <span
                      className="truncate block max-w-[420px]"
                      style={{ color: "var(--foreground-muted)" }}
                      title="No parsed sessions for this project"
                    >
                      {p.path}
                    </span>
                  )}
                </td>
                <td className="text-right num">{p.total}</td>
                <td className="font-mono text-xs">{p.topCommand ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {truncated > 0 ? (
        <p className="mt-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
          +{truncated} more projects not shown
        </p>
      ) : null}
    </div>
  );
}
