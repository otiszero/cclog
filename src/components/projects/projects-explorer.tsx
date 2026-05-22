"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";
import { Combobox } from "./combobox";

export type ProjectRow = {
  slug: string;
  realPath: string;
  sessionCount: number;
  tokens: number;
  cost: number;
  lastActive?: string;
  lastActiveMs: number;
  models: string[];
};

type SortKey = "project" | "sessions" | "tokens" | "cost" | "lastActive";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ACTIVITY_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Active in last 7 days" },
  { value: "30d", label: "Active in last 30 days" },
  { value: "90d", label: "Active in last 90 days" },
];

const ACTIVITY_MS: Record<string, number> = {
  "7d": 7 * 86_400_000,
  "30d": 30 * 86_400_000,
  "90d": 90 * 86_400_000,
};

export function ProjectsExplorer({
  rows,
  models,
  nowMs,
}: {
  rows: ProjectRow[];
  models: string[];
  nowMs: number;
}) {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [activity, setActivity] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const modelOptions = useMemo(
    () => [
      { value: "all", label: "All models" },
      ...models.map((m) => ({ value: m, label: m })),
    ],
    [models],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const window = ACTIVITY_MS[activity];
    return rows.filter((r) => {
      if (q && !r.realPath.toLowerCase().includes(q)) return false;
      if (model !== "all" && !r.models.includes(model)) return false;
      if (window != null) {
        if (r.lastActiveMs === 0) return false;
        if (nowMs - r.lastActiveMs > window) return false;
      }
      return true;
    });
  }, [rows, query, model, activity, nowMs]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "project":
          return a.realPath.localeCompare(b.realPath) * dir;
        case "sessions":
          return (a.sessionCount - b.sessionCount) * dir;
        case "tokens":
          return (a.tokens - b.tokens) * dir;
        case "cost":
          return (a.cost - b.cost) * dir;
        case "lastActive":
        default:
          return (a.lastActiveMs - b.lastActiveMs) * dir;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + pageSize);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "project" ? "asc" : "desc");
    }
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setModel("all");
    setActivity("all");
    setPage(1);
  }

  const filtersActive = query !== "" || model !== "all" || activity !== "all";

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--foreground-muted)" }}
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by path…"
            aria-label="Filter projects by path"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border outline-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
            }}
          />
        </div>

        <Combobox
          ariaLabel="Filter by model"
          value={model}
          onChange={(v) => {
            setModel(v);
            setPage(1);
          }}
          options={modelOptions}
          placeholder="Model"
          widthClass="w-56"
        />

        <Combobox
          ariaLabel="Filter by activity window"
          value={activity}
          onChange={(v) => {
            setActivity(v);
            setPage(1);
          }}
          options={ACTIVITY_OPTIONS}
          placeholder="Activity"
          widthClass="w-52"
        />

        {filtersActive && (
          <button type="button" onClick={resetFilters} className="btn text-xs">
            Reset
          </button>
        )}

        <div
          className="ml-auto text-xs"
          style={{ color: "var(--foreground-muted)" }}
        >
          {sorted.length} of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {pageRows.length === 0 ? (
          <p
            className="text-sm p-4"
            style={{ color: "var(--muted)" }}
          >
            No projects match the current filters.
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <SortHeader
                  label="Project"
                  k="project"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Sessions"
                  k="sessions"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Tokens"
                  k="tokens"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Cost"
                  k="cost"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Last active"
                  k="lastActive"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <Link
                      href={`/project/${encodeURIComponent(p.slug)}`}
                      className="truncate block max-w-[520px]"
                    >
                      {p.realPath}
                    </Link>
                  </td>
                  <td className="text-right num">{p.sessionCount}</td>
                  <td className="text-right num">{formatTokens(p.tokens)}</td>
                  <td className="text-right num">{formatCost(p.cost)}</td>
                  <td className="text-right">{formatRelative(p.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div style={{ color: "var(--foreground-muted)" }}>
            Showing {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)} of {sorted.length}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5" style={{ color: "var(--foreground-muted)" }}>
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-1.5 py-1 rounded-sm border bg-transparent text-xs"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <PagerButton
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
                label="«"
                ariaLabel="First page"
              />
              <PagerButton
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                label="‹"
                ariaLabel="Previous page"
              />
              <span className="px-2" style={{ color: "var(--foreground)" }}>
                {safePage} / {totalPages}
              </span>
              <PagerButton
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                label="›"
                ariaLabel="Next page"
              />
              <PagerButton
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
                label="»"
                ariaLabel="Last page"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  k,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  align?: "right";
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      className={align === "right" ? "text-right" : ""}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 uppercase tracking-wider"
        style={{
          color: active ? "var(--accent)" : "var(--foreground-muted)",
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: "0.06em",
          background: "transparent",
        }}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span style={{ width: 10, display: "inline-block" }}>{arrow}</span>
      </button>
    </th>
  );
}

function PagerButton({
  disabled,
  onClick,
  label,
  ariaLabel,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="px-2 py-1 rounded-sm border text-xs transition-colors"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        color: disabled ? "var(--foreground-subtle)" : "var(--foreground)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
