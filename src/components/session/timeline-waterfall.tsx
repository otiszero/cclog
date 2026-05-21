"use client";
import { useMemo, useState } from "react";
import type { SessionEvent, UserPromptSource } from "@/lib/types";
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

// Visual treatment per user-prompt source.
export const SOURCE_STYLE: Record<
  UserPromptSource,
  { color: string; bg: string; label: string; hint: string }
> = {
  human: {
    color: "var(--accent)",
    bg: "color-mix(in srgb, #0ea5e9 12%, transparent)",
    label: "user",
    hint: "Human prompt — text you typed",
  },
  slash_command: {
    color: "#f59e0b",
    bg: "color-mix(in srgb, #f59e0b 12%, transparent)",
    label: "slash",
    hint: "Slash command invocation (e.g. /cook, /git)",
  },
  system_injection: {
    color: "var(--muted)",
    bg: "color-mix(in srgb, var(--muted) 8%, transparent)",
    label: "system",
    hint: "CLI / hook auto-injection (skill body, caveat, system-reminder)",
  },
  sidechain: {
    color: "var(--muted)",
    bg: "transparent",
    label: "sidechain",
    hint: "Sub-agent conversation",
  },
};

type PromptGroup = {
  key: string;
  promptId?: string;
  ts: string; // earliest ts in group
  entries: PromptEv[];
  // primary entry decides header rendering: slash_command > human > system_injection
  primary: PromptEv;
  injections: PromptEv[]; // entries other than primary
};

type TimelineRow =
  | { kind: "prompt_group"; group: PromptGroup; deltaMs: number }
  | {
      kind: "turn";
      ev: TurnEv;
      toolEvents: ToolEv[];
      subAgents: string[];
      deltaMs: number;
    };

function pickPrimary(entries: PromptEv[]): PromptEv {
  const slash = entries.find((e) => e.source === "slash_command");
  if (slash) return slash;
  const human = entries.find((e) => e.source === "human");
  if (human) return human;
  return entries[0];
}

// Pretty header for a slash command: extract name from <command-name>X</command-name>.
export function parseSlashCommand(text: string): { name: string; args: string } {
  const nameMatch = text.match(/<command-name>([^<]*)<\/command-name>/);
  const argsMatch = text.match(/<command-args>([\s\S]*?)<\/command-args>/);
  return {
    name: (nameMatch?.[1] ?? "").trim() || "/?",
    args: (argsMatch?.[1] ?? "").trim(),
  };
}

export function TimelineWaterfall({ events }: TimelineProps) {
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [showInjections, setShowInjections] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

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
    let pending: { key: string; promptId?: string; entries: PromptEv[]; ts: string } | null = null;

    const flush = () => {
      if (!pending || pending.entries.length === 0) {
        pending = null;
        return;
      }
      const primary = pickPrimary(pending.entries);
      const group: PromptGroup = {
        key: pending.key,
        promptId: pending.promptId,
        ts: pending.ts,
        entries: pending.entries,
        primary,
        injections: pending.entries.filter((e) => e !== primary),
      };
      const ts = Date.parse(group.ts);
      const deltaMs = prevTs ? Math.max(0, ts - prevTs) : 0;
      out.push({ kind: "prompt_group", group, deltaMs });
      prevTs = ts;
      pending = null;
    };

    for (const e of events) {
      if (e.kind === "user_prompt") {
        if (e.source === "sidechain") continue;
        const key = e.promptId ? `pid:${e.promptId}` : `uid:${e.uuid || e.ts}`;
        if (pending && pending.key === key) {
          pending.entries.push(e);
        } else {
          flush();
          pending = { key, promptId: e.promptId, entries: [e], ts: e.ts };
        }
        continue;
      }
      if (e.kind === "turn") {
        flush();
        const ts = Date.parse(e.ts);
        const deltaMs = prevTs ? Math.max(0, ts - prevTs) : 0;
        const toolEvents = toolByParent.get(e.uuid) ?? [];
        const subAgents = events
          .filter((x) => x.kind === "sub_agent" && x.parentTurn === e.uuid)
          .map((x) => (x as Extract<SessionEvent, { kind: "sub_agent" }>).subAgentType);
        out.push({ kind: "turn", ev: e, toolEvents, subAgents, deltaMs });
        prevTs = ts;
      }
    }
    flush();
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
  const groupCount = rows.filter((r) => r.kind === "prompt_group").length;
  const humanCount = rows.filter(
    (r) => r.kind === "prompt_group" && r.group.primary.source === "human",
  ).length;
  const slashCount = rows.filter(
    (r) => r.kind === "prompt_group" && r.group.primary.source === "slash_command",
  ).length;

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <TimelineLegend />

      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--muted)" }}>
        <span>{humanCount} human</span>
        <span>·</span>
        <span>{slashCount} slash</span>
        <span>·</span>
        <span>{turnCount} turns</span>
        <span>·</span>
        <span>{groupCount + turnCount} rows</span>
        <span className="ml-auto">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInjections}
              onChange={(e) => setShowInjections(e.target.checked)}
            />
            <span>Show system injections</span>
          </label>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) =>
          r.kind === "prompt_group" ? (
            <PromptGroupRow
              key={`g-${r.group.key}-${i}`}
              row={r}
              expanded={expanded.has(r.group.key) || showInjections}
              onToggleExpand={() => toggleExpanded(r.group.key)}
              onSelectPrompt={(p) => setSelected({ kind: "prompt", data: p })}
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

function PromptGroupRow({
  row,
  expanded,
  onToggleExpand,
  onSelectPrompt,
}: {
  row: Extract<TimelineRow, { kind: "prompt_group" }>;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectPrompt: (p: PromptEv) => void;
}) {
  const { group, deltaMs } = row;
  const primary = group.primary;
  const injectionCount = group.injections.length;
  const style = SOURCE_STYLE[primary.source];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onSelectPrompt(primary)}
        className="flex items-start gap-2 py-1.5 px-2 rounded-md text-sm text-left hover:opacity-90"
        style={{ background: style.bg }}
      >
        <SourceIcon source={primary.source} />
        <span className="tag" style={{ color: style.color, borderColor: style.color }} title={style.hint}>
          {style.label}
        </span>
        <span className="flex-1 truncate" title={primary.text}>
          <PromptHeader ev={primary} />
        </span>
        {injectionCount > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="tag shrink-0"
            style={{ color: "var(--muted)", borderColor: "var(--border)" }}
            title={`${injectionCount} system injection${injectionCount > 1 ? "s" : ""} bundled with this prompt — click to ${expanded ? "hide" : "show"}`}
          >
            {expanded ? "−" : "+"}
            {injectionCount} system
          </button>
        ) : null}
        <Timestamp ts={primary.ts} deltaMs={deltaMs} />
      </button>

      {expanded && injectionCount > 0 ? (
        <div className="pl-6 flex flex-col gap-1">
          {group.injections.map((inj, idx) => {
            const s = SOURCE_STYLE[inj.source];
            return (
              <button
                key={`inj-${idx}`}
                type="button"
                onClick={() => onSelectPrompt(inj)}
                className="flex items-start gap-2 py-1 px-2 rounded text-xs text-left hover:opacity-90"
                style={{ background: s.bg }}
                title={s.hint}
              >
                <span
                  className="tag shrink-0"
                  style={{ color: s.color, borderColor: s.color }}
                >
                  {s.label}
                </span>
                <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>
                  {previewInjection(inj.text)}
                </span>
                <span
                  className="text-[10px] shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {inj.text.length.toLocaleString()} chars
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PromptHeader({ ev }: { ev: PromptEv }) {
  if (ev.source === "slash_command") {
    const { name, args } = parseSlashCommand(ev.text);
    return (
      <span>
        <span className="font-mono" style={{ color: "#f59e0b" }}>
          {name}
        </span>
        {args ? (
          <span className="ml-2" style={{ color: "var(--muted)" }}>
            {args.slice(0, 160)}
            {args.length > 160 ? "…" : ""}
          </span>
        ) : null}
      </span>
    );
  }
  if (ev.source === "system_injection") {
    return (
      <span style={{ color: "var(--muted)" }}>
        {previewInjection(ev.text).slice(0, 240)}
      </span>
    );
  }
  return <span>{ev.text.slice(0, 240)}</span>;
}

function previewInjection(text: string): string {
  // Strip leading XML-ish wrapper for a more readable preview
  const t = text.trimStart();
  const tagMatch = t.match(/^<([a-zA-Z][\w-]*)>([\s\S]*?)<\/\1>/);
  if (tagMatch) return `<${tagMatch[1]}> ${tagMatch[2].replace(/\s+/g, " ").trim().slice(0, 200)}`;
  return t.replace(/\s+/g, " ").slice(0, 200);
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

function SourceIcon({ source }: { source: UserPromptSource }) {
  const color = SOURCE_STYLE[source].color;
  if (source === "slash_command") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ color }} className="shrink-0 mt-0.5">
        <line x1="17" y1="5" x2="7" y2="19" />
      </svg>
    );
  }
  if (source === "system_injection") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color }} className="shrink-0 mt-0.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9h10M7 13h10M7 17h6" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color }} className="shrink-0 mt-0.5">
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
