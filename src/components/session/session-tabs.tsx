"use client";
import { useState } from "react";
import type { ParsedSession } from "@/lib/types";
import { TimelineWaterfall } from "./timeline-waterfall";
import { TokensStackedChart } from "./tokens-stacked-chart";
import { PromptViewer } from "./prompt-viewer";
import { turnSeries } from "@/lib/parser/derive-metrics";
import { LeaderboardCard } from "@/components/project/leaderboard-card";
import type { LeaderboardRow } from "@/lib/types";

type Tab = "timeline" | "tokens" | "prompts";

export function SessionTabs({
  parsed,
  byTool,
  byMcp,
  bySkill,
  bySubAgent,
}: {
  parsed: ParsedSession;
  byTool: LeaderboardRow[];
  byMcp: LeaderboardRow[];
  bySkill: LeaderboardRow[];
  bySubAgent: LeaderboardRow[];
}) {
  const [tab, setTab] = useState<Tab>("timeline");
  const series = turnSeries(parsed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {(["timeline", "tokens", "prompts"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-3 py-2 text-sm capitalize"
            style={{
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t ? "var(--foreground)" : "var(--muted)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "timeline" ? <TimelineWaterfall events={parsed.events} /> : null}

      {tab === "tokens" ? (
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-2">Tokens per turn</h3>
            <TokensStackedChart data={series} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LeaderboardCard title="Tools" rows={byTool} />
            <LeaderboardCard title="Sub-agents" rows={bySubAgent} />
            <LeaderboardCard title="MCP" rows={byMcp} />
            <LeaderboardCard title="Skills" rows={bySkill} />
          </div>
        </div>
      ) : null}

      {tab === "prompts" ? <PromptViewer events={parsed.events} /> : null}
    </div>
  );
}
