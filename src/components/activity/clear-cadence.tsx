import type { ActivityStats } from "@/lib/types";

// Context-reset cadence: how often a session is wiped with /clear. A low
// "entries between clears" suggests frequent context resets.
export function ClearCadence({ cadence }: { cadence: ActivityStats["clearCadence"] }) {
  const avg = cadence.avgEntriesBetweenClears;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-6">
        <div className="flex flex-col">
          <span className="kpi-value">{cadence.clears}</span>
          <span className="kpi-label">/clear calls</span>
        </div>
        <div className="flex flex-col">
          <span className="kpi-value">{avg > 0 ? avg.toFixed(1) : "—"}</span>
          <span className="kpi-label">entries between clears</span>
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
        Context-reset cadence — how many prompts/commands you type, on average,
        before wiping context with <code className="font-mono">/clear</code>.
      </p>
    </div>
  );
}
