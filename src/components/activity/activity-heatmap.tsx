import type { ActivityStats } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Pure CSS-grid heatmap of weekday × hour-of-day activity (local time). No chart
// lib needed — intensity is background opacity scaled to the busiest cell.
export function ActivityHeatmap({ heatmap }: { heatmap: ActivityStats["heatmap"] }) {
  const max = Math.max(1, ...heatmap.flat());

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: "34px repeat(24, 1fr)" }}>
        {/* header row: hour labels (every 3h to avoid clutter) */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`h${h}`}
            className="text-center tabular-nums"
            style={{ fontSize: 9, color: "var(--foreground-muted)" }}
          >
            {h % 3 === 0 ? h : ""}
          </div>
        ))}

        {DAYS.map((day, d) => (
          <Row key={day} day={day} counts={heatmap[d]} max={max} />
        ))}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
        Local time · darker = more activity · busiest cell = {max}
      </p>
    </div>
  );
}

function Row({ day, counts, max }: { day: string; counts: number[]; max: number }) {
  return (
    <>
      <div
        className="flex items-center"
        style={{ fontSize: 10, color: "var(--foreground-muted)" }}
      >
        {day}
      </div>
      {counts.map((n, h) => {
        const intensity = n === 0 ? 0 : 0.12 + 0.88 * (n / max);
        return (
          <div
            key={h}
            title={`${day} ${h}:00 — ${n} ${n === 1 ? "entry" : "entries"}`}
            className="rounded-[2px]"
            style={{
              aspectRatio: "1 / 1",
              minWidth: 12,
              background:
                n === 0
                  ? "var(--border)"
                  : `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, transparent)`,
            }}
          />
        );
      })}
    </>
  );
}
