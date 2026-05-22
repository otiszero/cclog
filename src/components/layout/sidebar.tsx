"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS, isActive } from "./sidebar-nav-items";

const STORAGE_KEY = "cclog:sidebar:collapsed";

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
    setHydrated(true);
  }, []);

  // Close mobile drawer on route change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const width = collapsed ? "3.5rem" : "14rem";

  return (
    <>
      {/* Mobile top strip */}
      <div
        className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b sticky top-0 z-20 backdrop-blur"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--background) 80%, transparent)",
        }}
      >
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md"
          style={{ color: "var(--foreground)" }}
        >
          <MenuIcon />
        </button>
        <Link
          href="/"
          className="font-semibold tracking-tight"
          aria-label="cclog home"
        >
          <span style={{ color: "var(--accent)" }}>cclog</span>
        </Link>
        <span aria-hidden className="w-9" />
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{
            background: "color-mix(in srgb, #000 45%, transparent)",
          }}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — desktop sticky / mobile drawer */}
      <aside
        aria-label="Primary"
        className={[
          "shrink-0 flex flex-col border-r",
          // Desktop: sticky in document flow
          "md:sticky md:top-0 md:h-dvh md:translate-x-0",
          // Mobile: fixed off-canvas drawer
          "fixed md:static inset-y-0 left-0 z-40 h-dvh",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{
          width,
          // On mobile drawer, force expanded width regardless of collapsed state
          ...(mobileOpen ? { width: "14rem" } : null),
          borderColor: "var(--border)",
          background: "var(--card)",
          transition: hydrated
            ? "width var(--dur-state) var(--ease-out), transform var(--dur-drawer) var(--ease-out)"
            : "transform var(--dur-drawer) var(--ease-out)",
        }}
      >
        {/* Branding */}
        <div
          className="flex items-center gap-2 px-3 py-4 border-b min-w-0"
          style={{ borderColor: "var(--border)" }}
        >
          <Link
            href="/"
            className="font-semibold tracking-tight text-base shrink-0"
            aria-label="cclog home"
            style={{ color: "var(--accent)" }}
          >
            cclog
          </Link>
          {(!collapsed || mobileOpen) && (
            <span
              className="text-[11px] truncate"
              style={{ color: "var(--foreground-muted)" }}
            >
              Claude Code log explorer
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const showLabel = !collapsed || mobileOpen;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                    className={[
                      "relative flex items-center gap-3 rounded-md text-sm transition-colors hover:no-underline",
                      showLabel ? "px-3 py-2" : "px-2 py-2 justify-center",
                    ].join(" ")}
                    style={{
                      color: active ? "var(--accent)" : "var(--foreground)",
                      background: active
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "transparent",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {active && showLabel && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
                        style={{ background: "var(--accent)" }}
                      />
                    )}
                    <span className="shrink-0 inline-flex">{item.icon}</span>
                    {showLabel && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle — desktop only */}
        <div
          className="hidden md:flex border-t p-2"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className={[
              "flex items-center gap-2 w-full rounded-md text-xs transition-colors",
              collapsed ? "justify-center p-2" : "px-3 py-2",
            ].join(" ")}
            style={{
              color: "var(--foreground-muted)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <ChevronIcon direction={collapsed ? "right" : "left"} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Mobile-only close */}
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="md:hidden absolute top-3 right-3 p-1 rounded-md"
            style={{ color: "var(--foreground-muted)" }}
          >
            <CloseIcon />
          </button>
        )}
      </aside>
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
