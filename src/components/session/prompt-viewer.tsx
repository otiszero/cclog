"use client";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { SessionEvent } from "@/lib/types";
import { formatCost, formatTokens } from "@/lib/format";
import { estimateCost } from "@/lib/pricing";

type Pair = {
  prompt: string;
  promptTs: string;
  responseTs: string;
  responseText: string;
  tokens: number;
  cost: number;
  model: string;
};

export function PromptViewer({ events }: { events: SessionEvent[] }) {
  const pairs: Pair[] = useMemo(() => {
    const out: Pair[] = [];
    let pendingPrompt: { ts: string; text: string } | null = null;
    for (const e of events) {
      if (e.kind === "user_prompt") {
        pendingPrompt = { ts: e.ts, text: e.text };
      } else if (e.kind === "turn") {
        if (pendingPrompt) {
          const tokens = e.usage.input + e.usage.output + e.usage.cacheRead + e.usage.cacheCreate;
          out.push({
            prompt: pendingPrompt.text,
            promptTs: pendingPrompt.ts,
            responseTs: e.ts,
            responseText: e.text,
            tokens,
            cost: estimateCost(e.model, e.usage),
            model: e.model,
          });
          pendingPrompt = null;
        }
      }
    }
    return out;
  }, [events]);

  if (pairs.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>No prompt/response pairs.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {pairs.map((p, i) => (
        <article key={i} className="card">
          <header className="flex items-center justify-between gap-3 mb-3">
            <span className="tag" style={{ color: "var(--accent)" }}>
              #{i + 1} · {p.model}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {formatTokens(p.tokens)} tokens · {formatCost(p.cost)}
            </span>
          </header>
          <section className="mb-3">
            <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
              USER
            </h4>
            <div className="whitespace-pre-wrap text-sm">{p.prompt.slice(0, 4000)}</div>
          </section>
          <section>
            <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
              ASSISTANT
            </h4>
            <div className="prose prose-sm max-w-none text-sm">
              <ReactMarkdown>{p.responseText.slice(0, 8000)}</ReactMarkdown>
            </div>
          </section>
        </article>
      ))}
    </div>
  );
}
