import { aggregateActivity } from "@/lib/parser/aggregate-activity";
import { ActivityKpiStrip } from "@/components/activity/kpi-strip";
import { CommandLeaderboard } from "@/components/activity/command-leaderboard";
import { ActivityHeatmap } from "@/components/activity/activity-heatmap";
import { PerProjectMix } from "@/components/activity/per-project-mix";
import { ClearCadence } from "@/components/activity/clear-cadence";
import { EmptyState } from "@/components/common/empty-state";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const stats = await aggregateActivity();

  if (stats.totalEntries === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="card">
          <EmptyState
            title="No history yet"
            hint="Type some prompts or slash commands in Claude Code and refresh — this view reads ~/.claude/history.jsonl."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />

      <ActivityKpiStrip stats={stats} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Top commands</h3>
          <CommandLeaderboard rows={stats.commandLeaderboard} />
        </div>
        <div className="card flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Activity heatmap</h3>
            <ActivityHeatmap heatmap={stats.heatmap} />
          </div>
          <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3">Context-reset cadence</h3>
            <ClearCadence cadence={stats.clearCadence} />
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="text-sm font-semibold mb-3">Activity by project</h3>
        <PerProjectMix rows={stats.perProject} truncated={stats.perProjectTruncated} />
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Activity</h1>
      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
        Command &amp; workflow habits from{" "}
        <code className="font-mono text-xs">~/.claude/history.jsonl</code>.
      </p>
    </header>
  );
}
