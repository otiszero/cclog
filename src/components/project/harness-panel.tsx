"use client";

import { useState } from "react";
import type { HarnessRecommendation, HarnessReport } from "@/lib/types";
import { formatTokens } from "@/lib/format";

const TAG_LABEL: Record<string, string> = {
  destructive_bash: "Destructive Bash",
  sensitive_read: "Sensitive read",
  network_egress: "Network egress",
  write_outside_cwd: "Write outside cwd",
};

function tagLabel(tag: string): string {
  return TAG_LABEL[tag] ?? tag;
}

export function HarnessPanel({ report }: { report: HarnessReport }) {
  const hasAny =
    report.riskByTag.length > 0 ||
    report.hookFires.length > 0 ||
    report.recommendations.length > 0;
  if (!hasAny) {
    return (
      <section className="card">
        <h3 className="text-sm font-semibold mb-2">Harness</h3>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No harness telemetry detected — no hooks fired, no risky tool calls.
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Harness</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          guardrail telemetry · recommendations
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RiskByTagCard report={report} />
        <HookFiresCard report={report} />
      </div>

      {report.topRisky.length > 0 ? <TopRiskyCard report={report} /> : null}
      {report.recommendations.length > 0 ? (
        <RecommendationsCard recs={report.recommendations} />
      ) : null}
    </section>
  );
}

function RiskByTagCard({ report }: { report: HarnessReport }) {
  return (
    <div className="card">
      <h4 className="text-sm font-semibold mb-2">Risky actions by tag</h4>
      {report.riskByTag.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No risky tool calls matched.
        </p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Tag</th>
              <th className="text-right">Hits</th>
              <th className="text-right">Guarded</th>
              <th className="text-right">Unguarded</th>
            </tr>
          </thead>
          <tbody>
            {report.riskByTag.map((r) => {
              const unguarded = r.count - r.guarded;
              return (
                <tr key={r.tag}>
                  <td>{tagLabel(r.tag)}</td>
                  <td className="text-right num">{r.count}</td>
                  <td className="text-right num">{r.guarded}</td>
                  <td
                    className="text-right num"
                    style={{ color: unguarded > 0 ? "#ef4444" : undefined }}
                  >
                    {unguarded}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function HookFiresCard({ report }: { report: HarnessReport }) {
  return (
    <div className="card">
      <h4 className="text-sm font-semibold mb-2">Hook fires</h4>
      {report.hookFires.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No PreToolUse / PostToolUse / SessionStart / UserPromptSubmit hooks
          observed.
        </p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Hook</th>
              <th>Event</th>
              <th className="text-right">Fires</th>
              <th
                className="text-right"
                title="Tokens injected via hook_additional_context — context inflation cost"
              >
                Ctx tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {report.hookFires.map((h) => (
              <tr key={`${h.hookEvent}::${h.hookName}`}>
                <td className="font-mono text-xs">{h.hookName || "—"}</td>
                <td className="text-xs">{h.hookEvent}</td>
                <td className="text-right num">{h.count}</td>
                <td className="text-right num">
                  {h.contextTokens > 0 ? formatTokens(h.contextTokens) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TopRiskyCard({ report }: { report: HarnessReport }) {
  return (
    <div className="card">
      <h4 className="text-sm font-semibold mb-2">Top risky calls</h4>
      <table className="data">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Tool</th>
            <th>Detail</th>
            <th className="text-right">Count</th>
            <th className="text-right">Guarded</th>
          </tr>
        </thead>
        <tbody>
          {report.topRisky.map((r, i) => (
            <tr key={i}>
              <td>{tagLabel(r.tag)}</td>
              <td className="font-mono text-xs">{r.toolName}</td>
              <td className="font-mono text-xs truncate max-w-[480px]" title={r.detail}>
                {r.detail}
              </td>
              <td className="text-right num">{r.count}</td>
              <td className="text-right num">{r.guarded}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecommendationsCard({ recs }: { recs: HarnessRecommendation[] }) {
  return (
    <div className="card">
      <h4 className="text-sm font-semibold mb-2">Recommended guardrails</h4>
      <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
        Patterns observed ≥3 times without a matching PreToolUse hook. Snippets
        are starters — review the regex and command before pasting.
      </p>
      <div className="flex flex-col gap-3">
        {recs.map((r) => (
          <RecommendationRow key={r.id} rec={r} />
        ))}
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: HarnessRecommendation }) {
  const [view, setView] = useState<"settings" | "script">("settings");
  const snippet = view === "settings" ? rec.settingsJson : rec.hookScript;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {tagLabel(rec.tag)} · {rec.toolName}
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {rec.occurrences} hits · {rec.guarded} guarded
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="text-xs"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: view === "settings" ? "var(--muted-bg, transparent)" : "transparent",
              fontWeight: view === "settings" ? 600 : 400,
            }}
            onClick={() => setView("settings")}
          >
            settings.json
          </button>
          <button
            type="button"
            className="text-xs"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: view === "script" ? "var(--muted-bg, transparent)" : "transparent",
              fontWeight: view === "script" ? 600 : 400,
            }}
            onClick={() => setView("script")}
          >
            hook script
          </button>
          <button
            type="button"
            className="text-xs"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
            }}
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(snippet).catch(() => {});
              }
            }}
          >
            Copy
          </button>
        </div>
      </div>
      {rec.samples.length > 0 ? (
        <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          Samples:{" "}
          <span className="font-mono">
            {rec.samples.slice(0, 3).map((s, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {s}
              </span>
            ))}
          </span>
        </div>
      ) : null}
      <pre
        className="text-xs"
        style={{
          background: "var(--muted-bg, rgba(0,0,0,0.04))",
          padding: 8,
          borderRadius: 4,
          overflow: "auto",
          maxHeight: 280,
          whiteSpace: "pre",
        }}
      >
        {snippet}
      </pre>
    </div>
  );
}
