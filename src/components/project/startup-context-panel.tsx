"use client";

import { useState } from "react";
import type { InjectedCategory, StartupContext } from "@/lib/types";
import { formatTokens } from "@/lib/format";

const CATEGORY_META: Record<InjectedCategory, { label: string; hint: string }> = {
  "global-instructions": { label: "Global instructions", hint: "~/.claude/CLAUDE.md" },
  "global-rules": { label: "Global rules", hint: "~/.claude/rules/*.md — auto-injected" },
  "global-memory": { label: "Global memory", hint: "~/.claude/memory/*.md" },
  "project-instructions": { label: "Project instructions", hint: "<project>/CLAUDE.md" },
  "project-memory": { label: "Project memory", hint: "projects/<slug>/memory/*.md" },
};

const ORDER: InjectedCategory[] = [
  "global-instructions",
  "global-rules",
  "global-memory",
  "project-instructions",
  "project-memory",
];

export function StartupContextPanel({ context }: { context: StartupContext }) {
  if (context.sources.length === 0) {
    return (
      <section className="card">
        <h3 className="text-sm font-semibold mb-2">Startup context</h3>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No CLAUDE.md, rules, or memory files found for this project.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Startup context</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          injected into every session before your first prompt
        </span>
      </header>

      <div className="card flex flex-col gap-1">
        <span className="kpi-label">Total injected (est.)</span>
        <span className="kpi-value">{formatTokens(context.totalTokens)} tok</span>
        <span className="text-xs num" style={{ color: "var(--foreground-muted)" }}>
          ≈ {formatTokens(context.sharedTokens)} shared · {formatTokens(context.projectTokens)}{" "}
          project-specific
        </span>
      </div>

      <div className="card flex flex-col gap-3">
        {ORDER.map((category) => (
          <CategoryGroup
            key={category}
            category={category}
            sources={context.sources.filter((s) => s.category === category)}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryGroup({
  category,
  sources,
}: {
  category: InjectedCategory;
  sources: StartupContext["sources"];
}) {
  const meta = CATEGORY_META[category];
  const tokens = sources.reduce((a, s) => a + s.estTokens, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{meta.label}</span>
        <span className="text-xs num" style={{ color: "var(--foreground-muted)" }}>
          {sources.length === 0 ? "none" : `${formatTokens(tokens)} tok · ${sources.length} file${sources.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {sources.length === 0 ? (
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {meta.hint} — not present
        </span>
      ) : (
        sources.map((s) => <FileRow key={s.path} source={s} />)
      )}
    </div>
  );
}

function FileRow({ source }: { source: StartupContext["sources"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px" }}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 w-full text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-mono text-xs truncate" title={source.path}>
          {open ? "▾ " : "▸ "}
          {source.label}
        </span>
        <span className="text-xs num shrink-0" style={{ color: "var(--foreground-muted)" }}>
          {formatTokens(source.estTokens)} tok
        </span>
      </button>
      {open ? (
        <pre
          className="text-xs mt-2"
          style={{
            background: "var(--muted-bg, rgba(0,0,0,0.04))",
            padding: 8,
            borderRadius: 4,
            overflow: "auto",
            maxHeight: 320,
            whiteSpace: "pre-wrap",
          }}
        >
          {source.content}
        </pre>
      ) : null}
    </div>
  );
}
