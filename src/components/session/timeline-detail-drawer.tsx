"use client";
import { useEffect, useState } from "react";
import type { SessionEvent, TokenUsage } from "@/lib/types";
import { formatDuration, formatTokens, formatCost } from "@/lib/format";
import { categorizeTool, toolDisplayName } from "@/lib/parser/categorize-tool";
import { estimateCost } from "@/lib/pricing";

type TurnEv = Extract<SessionEvent, { kind: "turn" }>;
type PromptEv = Extract<SessionEvent, { kind: "user_prompt" }>;
type ToolEv = Extract<SessionEvent, { kind: "tool_use" }>;

export type DetailItem =
  | { kind: "prompt"; data: PromptEv }
  | { kind: "turn"; data: TurnEv; toolEvents: ToolEv[]; subAgents: string[] }
  | { kind: "tool"; data: ToolEv };

const CAT_COLOR: Record<string, string> = {
  tool: "#0ea5e9",
  mcp: "#a855f7",
  skill: "var(--positive)",
  sub_agent: "var(--warning)",
};

export function TimelineDetailDrawer({
  item,
  onClose,
  onSelect,
}: {
  item: DetailItem | null;
  onClose: () => void;
  onSelect: (next: DetailItem) => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside
        className="w-full sm:w-[560px] h-full overflow-y-auto flex flex-col"
        style={{ background: "var(--background)", borderLeft: "1px solid var(--border)" }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{ background: "var(--background)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="tag" style={{ textTransform: "uppercase" }}>
              {item.kind}
            </span>
            <h2 className="text-sm font-semibold">
              {item.kind === "prompt"
                ? "User prompt"
                : item.kind === "turn"
                  ? "Assistant turn"
                  : `Tool call · ${item.data.name}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-2 py-1 rounded hover:bg-black/10"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 p-4 flex flex-col gap-4 text-sm">
          {item.kind === "prompt" ? <PromptBody data={item.data} /> : null}
          {item.kind === "turn" ? (
            <TurnBody data={item.data} toolEvents={item.toolEvents} subAgents={item.subAgents} onSelect={onSelect} />
          ) : null}
          {item.kind === "tool" ? <ToolBody data={item.data} /> : null}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="font-mono text-xs break-all">{value}</div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="text-[10px] px-1.5 py-0.5 rounded border"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {title}
        </div>
        <CopyBtn text={text} />
      </div>
      <pre
        className="text-xs font-mono whitespace-pre-wrap break-words rounded p-2 max-h-96 overflow-auto"
        style={{ background: "color-mix(in srgb, var(--muted) 10%, transparent)" }}
      >
        {text}
      </pre>
    </div>
  );
}

function RawJson({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const text = (() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  })();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] uppercase tracking-wider self-start"
        style={{ color: "var(--muted)" }}
      >
        {open ? "▼" : "▶"} Raw JSON
      </button>
      {open ? <Block title="" text={text} /> : null}
    </div>
  );
}

function Timestamps({ ts }: { ts: string }) {
  if (!ts) return <Field label="Timestamp" value="—" />;
  const d = new Date(ts);
  return <Field label="Timestamp" value={`${d.toLocaleString()} · ${ts}`} />;
}

const SOURCE_COLOR: Record<string, string> = {
  human: "var(--accent)",
  slash_command: "#f59e0b",
  system_injection: "var(--muted)",
  sidechain: "var(--muted)",
};

const SOURCE_LABEL: Record<string, string> = {
  human: "human — typed by you",
  slash_command: "slash command (CLI-formatted invocation)",
  system_injection: "system injection (CLI / hook auto-insert)",
  sidechain: "sidechain (sub-agent conversation)",
};

function PromptBody({ data }: { data: PromptEv }) {
  return (
    <>
      <Timestamps ts={data.ts} />
      <Field
        label="Source"
        value={
          <span style={{ color: SOURCE_COLOR[data.source] }}>
            {SOURCE_LABEL[data.source] ?? data.source}
          </span>
        }
      />
      <Field label="Prompt ID" value={data.promptId || "—"} />
      <Field label="UUID" value={data.uuid || "—"} />
      <Block title={`Text (${data.text.length} chars)`} text={data.text} />
      {data.raw !== undefined ? <RawJson value={data.raw} /> : null}
    </>
  );
}

function UsageTable({ usage, model }: { usage: TokenUsage; model: string }) {
  const total = usage.input + usage.output + usage.cacheRead + usage.cacheCreate;
  const cost = estimateCost(model, usage);
  const rows: [string, number][] = [
    ["Input", usage.input],
    ["Output", usage.output],
    ["Cache read", usage.cacheRead],
    ["Cache create", usage.cacheCreate],
    ["Total", total],
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        Usage · est cost {formatCost(cost)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--muted)" }}>{k}</span>
            <span>
              {formatTokens(v)} <span style={{ color: "var(--muted)" }}>({v.toLocaleString()})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TurnBody({
  data,
  toolEvents,
  subAgents,
  onSelect,
}: {
  data: TurnEv;
  toolEvents: ToolEv[];
  subAgents: string[];
  onSelect: (next: DetailItem) => void;
}) {
  return (
    <>
      <Timestamps ts={data.ts} />
      <Field label="UUID" value={data.uuid || "—"} />
      <Field label="Model" value={data.model} />
      <Field label="Duration" value={formatDuration(data.durationMs ?? 0)} />
      <UsageTable usage={data.usage} model={data.model} />
      {subAgents.length > 0 ? (
        <Field label="Sub-agents" value={subAgents.join(", ")} />
      ) : null}
      {toolEvents.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Tool calls ({toolEvents.length})
          </div>
          {toolEvents.map((t, i) => {
            const cat = categorizeTool(t.name);
            return (
              <button
                key={`${t.uuid}-${i}`}
                type="button"
                onClick={() => onSelect({ kind: "tool", data: t })}
                className="text-left text-xs font-mono flex items-start gap-2 leading-snug rounded px-2 py-1 hover:bg-black/5"
                style={{ border: "1px solid var(--border)" }}
              >
                <span
                  className="tag shrink-0"
                  style={{ color: CAT_COLOR[cat], borderColor: CAT_COLOR[cat] }}
                >
                  {cat}
                </span>
                <span className="shrink-0">{toolDisplayName(t.name, t.input ?? {})}</span>
                {t.resultPreview ? (
                  <span
                    className="flex-1 truncate"
                    style={{ color: t.resultOk === false ? "var(--warning)" : "var(--muted)" }}
                  >
                    → {t.resultPreview.slice(0, 160)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <Block title={`Assistant response (${data.text.length} chars)`} text={data.text} />
      {data.raw !== undefined ? <RawJson value={data.raw} /> : null}
    </>
  );
}

function ToolBody({ data }: { data: ToolEv }) {
  const cat = categorizeTool(data.name);
  const inputJson = (() => {
    try {
      return JSON.stringify(data.input, null, 2);
    } catch {
      return String(data.input);
    }
  })();
  return (
    <>
      <Timestamps ts={data.ts} />
      <Field label="Tool" value={`${data.name} · ${toolDisplayName(data.name, data.input ?? {})}`} />
      <Field
        label="Category"
        value={<span style={{ color: CAT_COLOR[cat] }}>{cat}</span>}
      />
      <Field label="UUID" value={data.uuid || "—"} />
      <Field label="Parent turn" value={data.parentTurn || "—"} />
      <Field
        label="Result status"
        value={
          data.resultOk === undefined ? (
            "—"
          ) : data.resultOk ? (
            <span style={{ color: "var(--positive)" }}>ok</span>
          ) : (
            <span style={{ color: "var(--warning)" }}>error</span>
          )
        }
      />
      <Block title="Input" text={inputJson} />
      <Block title="Result" text={data.resultFull ?? data.resultPreview ?? ""} />
      {data.raw !== undefined ? <RawJson value={data.raw} /> : null}
    </>
  );
}
