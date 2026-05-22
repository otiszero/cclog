"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/search", label: "Search" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname() ?? "/";

  return (
    <header
      className="px-4 md:px-6 py-3 border-b sticky top-0 z-20 backdrop-blur"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--background) 80%, transparent)",
      }}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="font-semibold tracking-tight rounded-sm"
            aria-label="cclog home"
          >
            <span style={{ color: "var(--accent)" }}>cclog</span>
          </Link>
          <span className="tag hidden sm:inline-flex">
            Claude Code log explorer
          </span>
        </div>
        <nav
          aria-label="Primary"
          className="flex items-center gap-1 text-sm"
        >
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="px-2.5 py-1.5 rounded-md transition-colors hover:no-underline"
                style={{
                  color: active ? "var(--accent)" : "var(--foreground)",
                  background: active
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
