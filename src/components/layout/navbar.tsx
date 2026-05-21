import Link from "next/link";

export function Navbar() {
  return (
    <header
      className="px-6 py-3 border-b sticky top-0 z-10 backdrop-blur"
      style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--background) 85%, transparent)" }}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold tracking-tight">
            analysis-<span style={{ color: "var(--accent)" }}>cc</span>
          </Link>
          <span className="tag">Claude Code log explorer</span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/">Dashboard</Link>
          <Link href="/search">Search</Link>
        </nav>
      </div>
    </header>
  );
}
