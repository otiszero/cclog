"use client";
import { useMemo, useState } from "react";
import type { SessionEvent } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { categorizeTool, toolDisplayName } from "@/lib/parser/categorize-tool";
import { TimelineLegend } from "./timeline-legend";
import { TimelineTokenBar } from "./timeline-token-bar";
import { TimelineDetailDrawer, type DetailItem } from "./timeline-detail-drawer";

type TimelineProps = {
  events: SessionEvent[];
};

type TurnEv = Extract<SessionEvent, { kind: "turn" }>;
type PromptEv = Extract<SessionEvent, { kind: "user_prompt" }>;
type ToolEv = Extract<SessionEvent, { kind: "tool_use" }>;

const CAT_COLOR: Record<string, string> = {
  tool: "#0ea5e9",
  mcp: "#a855f7",
  skill: "var(--positive)",
  sub_agent: "var(--warning)",
};

const CAT_HINT: Record<string, string> = {
  tool: "Built-in tool",
  mcp: "MCP server tool",
  skill: "Skill invocation",
  sub_agent: "Spawned sub-agent",
};

type TimelineRow =
  | { kind: "prompt"; ev: PromptEv; deltaMs: number }
  | {
      kind: "turn";
      ev: TurnEv;
      toolEvents: ToolEv[];
      subAgents: string[];
      deltaMs: number;
    };

export function TimelineWaterfall({ events }: TimelineProps) {
  const [selected, setSelected] = useState<DetailItem | null>(null);

  const rows = useMemo<TimelineRow[]>(() => {
    const toolByParent = new Map<string, ToolEv[]>();
    for (const e of events) {
      if (e.kind === "tool_use") {
        const list = toolByParent.get(e.parentTurn) ?? [];
        list.push(e);
        toolByParent.set(e.parentTurn, list);
      }
    }

    const out: TimelineRow[] = [];
    let prevTs = 0;
    for (const e of events) {
      if (e.kind !== "user_prompt" && e.kind !== "turn") continue;
      const ts = Date.parse(e.ts);
      const deltaMs = prevTs ? Math.max(0, ts - prevTs) : 0;

      if (e.kind === "user_prompt") {
        out.push({ kind: "prompt", ev: e, deltaMs });
      } else {
        const toolEvents = toolByParent.get(e.uuid) ?? [];
        const subAgents = events
          .filter((x) => x.kind === "sub_agent" && x.parentTurn === e.uuid)
          .map((x) => (x as Extract<SessionEvent, { kind: "sub_agent" }>).subAgentType);
        out.push({ kind: "turn", ev: e, toolEvents, subAgents, deltaMs });
      }
      prevTs = ts;
    }
    return out;
  }, [events]);

  const { maxTotal, maxWork } = useMemo(() => {
    let total = 1;
    let work = 1;
    for (const r of rows) {
      if (r.kind !== "turn") continue;
      const u = r.ev.usage;
      const t = u.input + u.output + u.cacheRead + u.cacheCreate;
      const w = u.output + u.cacheCreate;
      if (t > total) total = t;
      if (w > work) work = w;
    }
    return { maxTotal: total, maxWork: work };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No events recorded.
      </p>
    );
  }

  const turnCount = rows.filter((r) => r.kind === "turn").length;
  const promptCount = rows.filter((r) => r.kind === "prompt").length;

  return (
    <div className="flex flex-col gap-3">
      <TimelineLegend />

      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
        <span>{promptCount} prompts</span>
        <span>·</span>
        <span>{turnCount} turns</span>
        <span>·</span>
        <span>{rows.length} rows shown chronologically</span>
        <span>·</span>
        <span>Click a row or tool to inspect</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) =>
          r.kind === "prompt" ? (
            <PromptRow
              key={`p-${i}`}
              row={r}
              onClick={() => setSelected({ kind: "prompt", data: r.ev })}
            />
          ) : (
            <TurnRow
              key={r.ev.uuid}
              row={r}
              maxTotal={maxTotal}
              maxWork={maxWork}
              onClick={() =>
                setSelected({
                  kind: "turn",
                  data: r.ev,
                  toolEvents: r.toolEvents,
                  subAgents: r.subAgents,
                })
              }
              onToolClick={(tool) => setSelected({ kind: "tool", data: tool })}
            />
          ),
        )}
      </div>

      <TimelineDetailDrawer
        item={selected}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
      />
    </div>
  );
}

function PromptRow({
  row,
  onClick,
}: {
  row: Extract<TimelineRow, { kind: "prompt" }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-2 py-1.5 px-2 rounded-md text-sm text-left hover:opacity-90"
      style={{ background: "color-mix(in srgb, #0ea5e9 12%, transparent)" }}
    >
      <UserIcon />
      <span className="tag" style={{ color: "var(--accent)" }}>
        user
      </span>
      <span className="flex-1 truncate" title={row.ev.text}>
        {row.ev.text.slice(0, 240)}
      </span>
      <Timestamp ts={row.ev.ts} deltaMs={row.deltaMs} />
    </button>
  );
}

function TurnRow({
  row,
  maxTotal,
  maxWork,
  onClick,
  onToolClick,
}: {
  row: Extract<TimelineRow, { kind: "turn" }>;
  maxTotal: number;
  maxWork: number;
  onClick: () => void;
  onToolClick: (tool: ToolEv) => void;
}) {
  const { ev, toolEvents, subAgents } = row;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="rounded-md border px-3 py-2 flex flex-col gap-1 text-left cursor-pointer hover:bg-black/[0.02]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <BotIcon />
        <span className="tag" title={`Model: ${ev.model}`}>
          {ev.model}
        </span>
        <span style={{ color: "var(--muted)" }} title="Wall-clock duration of this turn">
          {formatDuration(ev.durationMs ?? 0)}
        </span>
        {toolEvents.length > 0 ? (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
            title={
              toolEvents.length > 1
                ? "Tool calls emitted in this turn. Multiple tool_use blocks within one assistant message run in parallel — the turn's wall-clock duration covers the whole batch, not a sum of per-tool times."
                : "Tool call made during this turn"
            }
          >
            <WrenchIcon />
            {toolEvents.length}
          </span>
        ) : null}
        {toolEvents.length > 1 ? (
          <span
            className="tag"
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
            title="These tools were emitted in a single assistant message — Claude Code runs them concurrently. Per-tool timing is not recorded in the JSONL."
          >
            parallel
          </span>
        ) : null}
        {subAgents.length > 0 ? (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: "var(--warning)" }}
            title={`Sub-agents spawned: ${subAgents.join(", ")}`}
          >
            <AgentIcon />
            {subAgents.join(", ")}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <Timestamp ts={ev.ts} deltaMs={row.deltaMs} />
        </span>
      </div>

      <TimelineTokenBar usage={ev.usage} model={ev.model} maxTotal={maxTotal} maxWork={maxWork} />

      {toolEvents.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {toolEvents.slice(0, 12).map((t, k) => {
            const cat = categorizeTool(t.name);
            return (
              <button
                key={`${t.uuid}-${k}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToolClick(t);
                }}
                className="tag"
                style={{ color: CAT_COLOR[cat], borderColor: CAT_COLOR[cat] }}
                title={`${CAT_HINT[cat]} · ${t.name} · click for full details`}
              >
                {toolDisplayName(t.name, t.input ?? {})}
              </button>
            );
          })}
          {toolEvents.length > 12 ? (
            <span className="tag" title={`${toolEvents.length - 12} more tool calls hidden`}>
              +{toolEvents.length - 12} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Timestamp({ ts, deltaMs }: { ts: string; deltaMs: number }) {
  const abs = new Date(ts).toLocaleTimeString();
  return (
    <span
      className="text-xs tabular-nums cursor-help"
      style={{ color: "var(--muted)" }}
      title={`Absolute: ${new Date(ts).toLocaleString()}\nSince previous event: ${formatDuration(deltaMs)}`}
    >
      {abs}
      {deltaMs > 0 ? (
        <span className="ml-1 opacity-70">(+{formatDuration(deltaMs)})</span>
      ) : null}
    </span>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }} className="shrink-0 mt-0.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }} className="shrink-0">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 3v5" />
      <circle cx="8.5" cy="14" r="1" />
      <circle cx="15.5" cy="14" r="1" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.6-2.6 2.6-2.6z" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <path d="M20 6l1 1 2-2" />
    </svg>
  );
}
