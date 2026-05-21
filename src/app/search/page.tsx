"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { searchPrompts } from "./actions";
import type { PromptDoc } from "@/lib/parser/build-prompt-index";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromptDoc[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      startTransition(async () => {
        const r = await searchPrompts(query);
        setResults(r);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Prompt search</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Full-text search across every user prompt in every session.
        </p>
      </header>

      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search prompts… (e.g. 'refactor parser')"
        className="card text-base"
        style={{ outline: "none", padding: "12px 16px" }}
      />

      {pending ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Searching…</p>
      ) : null}

      {!pending && query && results.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>No matches.</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {results.map((r, i) => (
          <Link
            key={`${r.sessionId}-${i}`}
            href={`/project/${encodeURIComponent(r.projectSlug)}/session/${r.sessionId}`}
            className="card hover:border-[var(--accent)] no-underline"
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs truncate" style={{ color: "var(--muted)" }}>
                {r.realPath}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {formatRelative(r.ts)} · {r.model} · {formatTokens(r.tokens)} ·{" "}
                {formatCost(r.cost)}
              </span>
            </div>
            <p className="text-sm line-clamp-3">{r.text.slice(0, 320)}</p>
            {r.responseSnippet ? (
              <p
                className="text-xs mt-1 line-clamp-2 italic"
                style={{ color: "var(--muted)" }}
              >
                → {r.responseSnippet}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
