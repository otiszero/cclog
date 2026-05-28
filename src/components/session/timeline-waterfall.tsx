"use client";
import { useMemo, useState } from "react";
import type { AntiPatternFinding, SessionEvent, UserPromptSource } from "@/lib/types";
import { formatCost, formatDuration, formatTokens } from "@/lib/format";
import { estimateCost } from "@/lib/pricing";
import { categorizeTool, toolDisplayName } from "@/lib/parser/categorize-tool";
import { TimelineLegend } from "./timeline-legend";
import { TimelineTokenBar } from "./timeline-token-bar";
import { TimelineDetailDrawer, type DetailItem } from "./timeline-detail-drawer";

type TimelineProps = {
  events: SessionEvent[];
  findingsByTurn?: Map<string, AntiPatternFinding[]>;
  // Per-turn window pressure (0-1), aligned with assistant turn events in order.
  windowPressure?: number[];
};

const FINDING_LABEL: Record<AntiPatternFinding["kind"], string> = {
  re_grep_loop: "re-read loop",
  tool_output_explosion: "big tool output",
  retry_loop: "retry loop",
  flailing_edit: "flailing edits",
  lost_in_middle: "lost in middle",
  should_have_compacted: "should have compacted",
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

type TurnNode = {
  ev: TurnEv;
  toolEvents: ToolEv[];
  subAgents: string[];
  deltaMs: number;
};

type PromptGroupRowT = {
  kind: "prompt_group";
  group: PromptGroup;
  deltaMs: number;
  turns: TurnNode[];
};
type OrphanTurnRowT = {
  kind: "turn"; // orphan turn before any prompt
  node: TurnNode;
};
type TimelineRow = PromptGroupRowT | OrphanTurnRowT;

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

export function TimelineWaterfall({ events, findingsByTurn, windowPressure }: TimelineProps) {
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [expandAll, setExpandAll] = useState(false);
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
    let pendingPrompt: { key: string; promptId?: string; entries: PromptEv[]; ts: string } | null =
      null;
    let currentGroupRow: PromptGroupRowT | null = null;

    const finalizePrompt = () => {
      if (!pendingPrompt || pendingPrompt.entries.length === 0) {
        pendingPrompt = null;
        return;
      }
      const primary = pickPrimary(pendingPrompt.entries);
      const group: PromptGroup = {
        key: pendingPrompt.key,
        promptId: pendingPrompt.promptId,
        ts: pendingPrompt.ts,
        entries: pendingPrompt.entries,
        primary,
        injections: pendingPrompt.entries.filter((e) => e !== primary),
      };
      const ts = Date.parse(group.ts);
      const deltaMs = prevTs ? Math.max(0, ts - prevTs) : 0;
      const row: PromptGroupRowT = {
        kind: "prompt_group",
        group,
        deltaMs,
        turns: [],
      };
      out.push(row);
      currentGroupRow = row;
      prevTs = ts;
      pendingPrompt = null;
    };

    for (const e of events) {
      if (e.kind === "user_prompt") {
        if (e.source === "sidechain") continue;
        const key = e.promptId ? `pid:${e.promptId}` : `uid:${e.uuid || e.ts}`;
        if (pendingPrompt && pendingPrompt.key === key) {
          pendingPrompt.entries.push(e);
        } else {
          finalizePrompt();
          pendingPrompt = { key, promptId: e.promptId, entries: [e], ts: e.ts };
        }
        continue;
      }
      if (e.kind === "turn") {
        finalizePrompt();
        const ts = Date.parse(e.ts);
        const deltaMs = prevTs ? Math.max(0, ts - prevTs) : 0;
        const toolEvents = toolByParent.get(e.uuid) ?? [];
        const subAgents = events
          .filter((x) => x.kind === "sub_agent" && x.parentTurn === e.uuid)
          .map((x) => (x as Extract<SessionEvent, { kind: "sub_agent" }>).subAgentType);
        const node: TurnNode = { ev: e, toolEvents, subAgents, deltaMs };
        const grp = currentGroupRow as PromptGroupRowT | null;
        if (grp) {
          grp.turns.push(node);
        } else {
          out.push({ kind: "turn", node });
        }
        prevTs = ts;
      }
    }
    finalizePrompt();
    return out;
  }, [events]);

  const pressureByTurn = useMemo(() => {
    const m = new Map<string, number>();
    if (!windowPressure || windowPressure.length === 0) return m;
    let i = 0;
    for (const e of events) {
      if (e.kind !== "turn") continue;
      const p = windowPressure[i++];
      if (typeof p === "number") m.set(e.uuid, p);
    }
    return m;
  }, [events, windowPressure]);

  const { maxTotal, maxWork } = useMemo(() => {
    let total = 1;
    let work = 1;
    const visit = (n: TurnNode) => {
      const u = n.ev.usage;
      const t = u.input + u.output + u.cacheRead + u.cacheCreate;
      const w = u.output + u.cacheCreate;
      if (t > total) total = t;
      if (w > work) work = w;
    };
    for (const r of rows) {
      if (r.kind === "turn") visit(r.node);
      else r.turns.forEach(visit);
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

  let turnCount = 0;
  for (const r of rows) {
    if (r.kind === "turn") turnCount += 1;
    else turnCount += r.turns.length;
  }
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
        <span>{groupCount} prompt groups</span>
        <span className="ml-auto">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={expandAll}
              onChange={(e) => setExpandAll(e.target.checked)}
            />
            <span>Expand all</span>
          </label>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) =>
          r.kind === "prompt_group" ? (
            <PromptGroupRow
              key={`g-${r.group.key}-${i}`}
              row={r}
              expanded={expandAll || expanded.has(r.group.key)}
              onToggleExpand={() => toggleExpanded(r.group.key)}
              onSelectPrompt={(p) => setSelected({ kind: "prompt", data: p })}
              onSelectTurn={(node) =>
                setSelected({
                  kind: "turn",
                  data: node.ev,
                  toolEvents: node.toolEvents,
                  subAgents: node.subAgents,
                })
              }
              onSelectTool={(t) => setSelected({ kind: "tool", data: t })}
              maxTotal={maxTotal}
              maxWork={maxWork}
              findingsByTurn={findingsByTurn}
              pressureByTurn={pressureByTurn}
            />
          ) : (
            <TurnRow
              key={r.node.ev.uuid}
              node={r.node}
              maxTotal={maxTotal}
              maxWork={maxWork}
              findings={findingsByTurn?.get(r.node.ev.uuid)}
              pressure={pressureByTurn.get(r.node.ev.uuid)}
              onClick={() =>
                setSelected({
                  kind: "turn",
                  data: r.node.ev,
                  toolEvents: r.node.toolEvents,
                  subAgents: r.node.subAgents,
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

function summarizeTurns(turns: TurnNode[]): {
  count: number;
  durationMs: number;
  toolCount: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  models: string[];
} {
  let durationMs = 0;
  let toolCount = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let cost = 0;
  const models = new Set<string>();
  for (const t of turns) {
    const u = t.ev.usage;
    durationMs += t.ev.durationMs ?? 0;
    toolCount += t.toolEvents.length;
    outputTokens += u.output + u.cacheCreate;
    totalTokens += u.input + u.output + u.cacheRead + u.cacheCreate;
    cost += estimateCost(t.ev.model, u);
    models.add(t.ev.model);
  }
  return {
    count: turns.length,
    durationMs,
    toolCount,
    outputTokens,
    totalTokens,
    cost,
    models: [...models],
  };
}

function PromptGroupRow({
  row,
  expanded,
  onToggleExpand,
  onSelectPrompt,
  onSelectTurn,
  onSelectTool,
  maxTotal,
  maxWork,
  findingsByTurn,
  pressureByTurn,
}: {
  row: Extract<TimelineRow, { kind: "prompt_group" }>;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectPrompt: (p: PromptEv) => void;
  onSelectTurn: (n: TurnNode) => void;
  onSelectTool: (t: ToolEv) => void;
  maxTotal: number;
  maxWork: number;
  findingsByTurn?: Map<string, AntiPatternFinding[]>;
  pressureByTurn: Map<string, number>;
}) {
  const { group, deltaMs, turns } = row;
  const primary = group.primary;
  const injectionCount = group.injections.length;
  const style = SOURCE_STYLE[primary.source];
  const summary = summarizeTurns(turns);
  const hasExpandable = injectionCount > 0 || turns.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-start gap-2 py-1.5 px-2 rounded-md text-sm"
        style={{ background: style.bg }}
      >
        {hasExpandable ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="shrink-0 mt-0.5 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-black/10"
            style={{ color: "var(--muted)" }}
            title={expanded ? "Collapse" : "Expand"}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <Chevron open={expanded} />
          </button>
        ) : (
          <span className="shrink-0 mt-0.5 w-4 h-4" />
        )}
        <button
          type="button"
          onClick={() => onSelectPrompt(primary)}
          className="flex-1 min-w-0 flex items-start gap-2 text-left hover:opacity-90"
        >
          <SourceIcon source={primary.source} />
          <span
            className="tag"
            style={{ color: style.color, borderColor: style.color }}
            title={style.hint}
          >
            {style.label}
          </span>
          <span className="flex-1 truncate" title={primary.text}>
            <PromptHeader ev={primary} />
          </span>
        </button>
        {turns.length > 0 ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="tag shrink-0 hidden sm:inline-flex"
            style={{ color: "var(--muted)", borderColor: "var(--border)" }}
            title={`${summary.count} assistant turn${summary.count > 1 ? "s" : ""}\nDuration: ${formatDuration(summary.durationMs)}\nTools: ${summary.toolCount}\nTotal tokens: ${summary.totalTokens.toLocaleString()} (output+cache: ${summary.outputTokens.toLocaleString()})\nEst. cost: ${formatCost(summary.cost)}\nModels: ${summary.models.join(", ")}`}
          >
            {summary.count}↵ · {formatDuration(summary.durationMs)}
            {summary.toolCount > 0 ? ` · ${summary.toolCount}🔧` : ""} ·{" "}
            {formatTokens(summary.totalTokens)} · {formatCost(summary.cost)}
          </button>
        ) : null}
        {injectionCount > 0 ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="tag shrink-0"
            style={{ color: "var(--muted)", borderColor: "var(--border)" }}
            title={`${injectionCount} system injection${injectionCount > 1 ? "s" : ""} bundled with this prompt`}
          >
            +{injectionCount} sys
          </button>
        ) : null}
        <Timestamp ts={primary.ts} deltaMs={deltaMs} />
      </div>

      {expanded ? (
        <div
          className="ml-3 pl-3 flex flex-col gap-1.5 border-l"
          style={{ borderColor: "var(--border)" }}
        >
          {injectionCount > 0
            ? group.injections.map((inj, idx) => {
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
                    <span className="text-[10px] shrink-0" style={{ color: "var(--muted)" }}>
                      {inj.text.length.toLocaleString()} chars
                    </span>
                  </button>
                );
              })
            : null}
          {turns.map((node) => (
            <TurnRow
              key={node.ev.uuid}
              node={node}
              maxTotal={maxTotal}
              maxWork={maxWork}
              findings={findingsByTurn?.get(node.ev.uuid)}
              pressure={pressureByTurn.get(node.ev.uuid)}
              onClick={() => onSelectTurn(node)}
              onToolClick={onSelectTool}
            />
          ))}
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
  node,
  maxTotal,
  maxWork,
  onClick,
  onToolClick,
  findings,
  pressure,
}: {
  node: TurnNode;
  maxTotal: number;
  maxWork: number;
  onClick: () => void;
  onToolClick: (tool: ToolEv) => void;
  findings?: AntiPatternFinding[];
  pressure?: number;
}) {
  const { ev, toolEvents, subAgents, deltaMs } = node;
  const u = ev.usage;
  const totalTokens = u.input + u.output + u.cacheRead + u.cacheCreate;
  const cost = estimateCost(ev.model, u);
  const flagged = (findings?.length ?? 0) > 0;
  const flagTitle = flagged
    ? findings!
        .map((f) => `${FINDING_LABEL[f.kind]}: ${f.label} (${f.detail})`)
        .join("\n")
    : "";
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
      style={{
        borderColor: flagged ? "#ef4444" : "var(--border)",
        background: flagged ? "color-mix(in srgb, #ef4444 5%, transparent)" : undefined,
      }}
    >
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <BotIcon />
        <span className="tag" title={`Model: ${ev.model}`}>
          {ev.model}
        </span>
        <span style={{ color: "var(--muted)" }} title="Wall-clock duration of this turn">
          {formatDuration(ev.durationMs ?? 0)}
        </span>
        <span
          className="tag"
          style={{ color: "var(--muted)", borderColor: "var(--border)" }}
          title={`Total tokens: ${totalTokens.toLocaleString()}\n  input: ${u.input.toLocaleString()}\n  output: ${u.output.toLocaleString()}\n  cache read: ${u.cacheRead.toLocaleString()}\n  cache create: ${u.cacheCreate.toLocaleString()}`}
        >
          {formatTokens(totalTokens)}
        </span>
        <span
          className="tag"
          style={{ color: "var(--muted)", borderColor: "var(--border)" }}
          title={`Estimated cost based on ${ev.model} pricing`}
        >
          {formatCost(cost)}
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
        {flagged ? (
          <span
            className="tag"
            style={{ color: "#ef4444", borderColor: "#ef4444" }}
            title={flagTitle}
          >
            ⚑ {findings!.length === 1 ? FINDING_LABEL[findings![0].kind] : `${findings!.length} flags`}
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
          <Timestamp ts={ev.ts} deltaMs={deltaMs} />
        </span>
      </div>

      <TimelineTokenBar usage={ev.usage} model={ev.model} maxTotal={maxTotal} maxWork={maxWork} />

      {typeof pressure === "number" ? <PressureBar pressure={pressure} /> : null}

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

function PressureBar({ pressure }: { pressure: number }) {
  const pct = Math.max(0, Math.min(1, pressure));
  const pctLabel = Math.round(pct * 100);
  const color =
    pct >= 0.8 ? "#ef4444" : pct >= 0.6 ? "var(--warning)" : "var(--positive)";
  return (
    <div
      className="flex items-center gap-2 text-[10px] mt-0.5"
      title={`Window pressure: ${pctLabel}% of 200k token context. ≥80% triggers a 'should have compacted' flag.`}
    >
      <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)", minWidth: 30 }}>
        ctx
      </span>
      <div
        className="flex-1 h-1 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          style={{
            width: `${pctLabel}%`,
            height: "100%",
            background: color,
            transition: "width 200ms",
          }}
        />
      </div>
      <span className="tabular-nums shrink-0" style={{ color, minWidth: 32 }}>
        {pctLabel}%
      </span>
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 120ms" }}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
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
