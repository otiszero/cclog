import { aggregateContextSummary } from "@/lib/parser/aggregate-startup-context";
import { ContextComparisonTable } from "@/components/context/context-comparison-table";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { formatTokens } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContextPage() {
  const summary = await aggregateContextSummary();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Startup context</h1>
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          What Claude Code injects into every session before your first prompt, reconstructed from
          current <code className="font-mono text-xs">~/.claude</code> files.
        </p>
      </header>

      {summary.projects.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No projects found"
            hint="Start a Claude Code session somewhere and refresh."
          />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              label="Shared base"
              value={`${formatTokens(summary.sharedTokens)} tok`}
              sub="every session, every project"
            />
            <KpiCard label="Projects" value={String(summary.projects.length)} />
            <KpiCard
              label="Heaviest project"
              value={`${formatTokens(summary.projects[0].totalTokens)} tok`}
              sub={summary.projects[0].realPath.split("/").pop()}
            />
          </section>

          <section className="card">
            <h3 className="text-sm font-semibold mb-1">Per-project injection cost</h3>
            <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
              The shared base ({formatTokens(summary.sharedTokens)} tok of global instructions +
              rules) is identical everywhere; the project-specific column is each project&apos;s own
              CLAUDE.md + memory on top.
            </p>
            <ContextComparisonTable summary={summary} />
          </section>
        </>
      )}
    </div>
  );
}
