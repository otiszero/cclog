"use client";
import { useMemo, useState } from "react";
import type { SessionEvent, ToolUseRef } from "@/lib/types";
import { formatDuration, formatTokens } from "@/lib/format";
import { categorizeTool, toolDisplayName } from "@/lib/parser/categorize-tool";

type TimelineProps = {
  events: SessionEvent[];
};

const CAT_COLOR: Record<string, string> = {
  tool: "#0ea5e9",
  mcp: "#a855f7",
  skill: "var(--positive)",
  sub_agent: "var(--warning)",
};

export function TimelineWaterfall({ events }: TimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    type Row =
      | { kind: "prompt"; ts: string; text: string }
      | {
          kind: "turn";
          uuid: string;
          ts: string;
          model: string;
          tokens: number;
          durationMs: number;
          text: string;
          tools: ToolUseRef[];
          subAgents: string[];
        };
    const out: Row[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.kind === "user_prompt") {
        out.push({ kind: "prompt", ts: e.ts, text: e.text });
      } else if (e.kind === "turn") {
        const tokens =
          e.usage.input + e.usage.output + e.usage.cacheRead + e.usage.cacheCreate;
        // collect sub_agent events that share parentTurn
        const subAgents = events
          .filter((x) => x.kind === "sub_agent" && x.parentTurn === e.uuid)
          .map((x) => (x as Extract<SessionEvent, { kind: "sub_agent" }>).subAgentType);
        out.push({
          kind: "turn",
          uuid: e.uuid,
          ts: e.ts,
          model: e.model,
          tokens,
          durationMs: e.durationMs ?? 0,
          text: e.text,
          tools: e.toolUses,
          subAgents,
        });
      }
    }
    return out;
  }, [events]);

  const maxTokens = useMemo(
    () => Math.max(1, ...rows.filter((r) => r.kind === "turn").map((r) => r.tokens)),
    [rows],
  );

  if (rows.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>No events recorded.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => {
        if (r.kind === "prompt") {
          return (
            <div
              key={`p-${i}`}
              className="flex items-start gap-2 py-1.5 px-2 rounded-md text-sm"
              style={{ background: "color-mix(in srgb, #0ea5e9 12%, transparent)" }}
            >
              <span className="tag" style={{ color: "var(--accent)" }}>user</span>
              <span className="flex-1 truncate" title={r.text}>
                {r.text.slice(0, 240)}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {new Date(r.ts).toLocaleTimeString()}
              </span>
            </div>
          );
        }
        const isOpen = expanded.has(r.uuid);
        const pct = Math.min(100, (r.tokens / maxTokens) * 100);
        return (
          <div key={r.uuid} className="rounded-md border" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => {
                const next = new Set(expanded);
                if (isOpen) next.delete(r.uuid);
                else next.add(r.uuid);
                setExpanded(next);
              }}
              className="w-full text-left px-3 py-2 flex flex-col gap-1"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="tag">{r.model}</span>
                <span style={{ color: "var(--muted)" }}>
                  {formatTokens(r.tokens)} tokens · {formatDuration(r.durationMs)}
                </span>
                {r.tools.length > 0 ? (
                  <span style={{ color: "var(--muted)" }}>
                    · {r.tools.length} tool{r.tools.length > 1 ? "s" : ""}
                  </span>
                ) : null}
                {r.subAgents.length > 0 ? (
                  <span style={{ color: "var(--warning)" }}>
                    · {r.subAgents.length} agent{r.subAgents.length > 1 ? "s" : ""}
                  </span>
                ) : null}
                <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(r.ts).toLocaleTimeString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }}
                />
              </div>
              {r.tools.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.tools.slice(0, 12).map((t, k) => (
                    <span
                      key={`${t.uuid}-${k}`}
                      className="tag"
                      style={{
                        color: CAT_COLOR[categorizeTool(t.name)],
                        borderColor: CAT_COLOR[categorizeTool(t.name)],
                      }}
                      title={t.name}
                    >
                      {toolDisplayName(t.name, {})}
                    </span>
                  ))}
                  {r.tools.length > 12 ? (
                    <span className="tag">+{r.tools.length - 12} more</span>
                  ) : null}
                </div>
              ) : null}
            </button>
            {isOpen && r.text ? (
              <div
                className="px-3 py-2 border-t text-sm whitespace-pre-wrap font-mono"
                style={{ borderColor: "var(--border)", color: "var(--muted)", fontSize: 12 }}
              >
                {r.text.slice(0, 4000)}
                {r.text.length > 4000 ? "\n…(truncated)" : ""}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
