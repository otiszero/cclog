"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  ariaLabel: string;
  emptyLabel?: string;
  widthClass?: string;
};

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  emptyLabel = "No matches",
  widthClass = "w-56",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  function commit(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIdx];
      if (pick) commit(pick.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm rounded-md border transition-colors"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
          color: selected ? "var(--foreground)" : "var(--foreground-muted)",
        }}
      >
        <span className="truncate text-left">
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{ color: "var(--foreground-muted)" }}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 left-0 right-0 rounded-md border shadow-lg overflow-hidden"
          style={{
            borderColor: "var(--border)",
            background: "var(--card)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          <div
            className="p-1.5 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={onKey}
              placeholder="Type to filter…"
              className="w-full px-2 py-1 text-sm rounded-sm bg-transparent outline-none"
              style={{ color: "var(--foreground)" }}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li
                className="px-3 py-2 text-xs"
                style={{ color: "var(--foreground-muted)" }}
              >
                {emptyLabel}
              </li>
            ) : (
              filtered.map((o, i) => {
                const active = i === activeIdx;
                const selectedRow = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedRow}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => commit(o.value)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-left"
                      style={{
                        background: active
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "transparent",
                        color: selectedRow ? "var(--accent)" : "var(--foreground)",
                        fontWeight: selectedRow ? 600 : 400,
                      }}
                    >
                      <span className="truncate">{o.label}</span>
                      {o.hint && (
                        <span
                          className="text-[11px] shrink-0"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {o.hint}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
