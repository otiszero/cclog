"use client";
import { useState } from "react";
import { TOKEN_COLORS } from "./timeline-token-bar";

// Inline legend explaining what every visual element on the Timeline means.
// Collapsible so it doesn't take vertical space once the user has read it.
export function TimelineLegend() {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="rounded-md border text-xs"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2"
      >
        <span className="flex items-center gap-2">
          <InfoIcon />
          <span className="font-semibold">How to read this timeline</span>
        </span>
        <span style={{ color: "var(--muted)" }}>{open ? "hide" : "show"}</span>
      </button>
      {open ? (
        <div
          className="px-3 pb-3 pt-1 flex flex-col gap-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <Section title="Rows">
            <Item>
              <RowSwatch kind="human" />
              <span>
                <b>User</b> — text you typed.
              </span>
            </Item>
            <Item>
              <RowSwatch kind="slash" />
              <span>
                <b>Slash command</b> — invocation like <code>/cook</code>,{" "}
                <code>/git</code>. The skill body the CLI auto-attaches is shown as
                a bundled <i>system</i> entry.
              </span>
            </Item>
            <Item>
              <RowSwatch kind="system" />
              <span>
                <b>System injection</b> — hidden by default. Caveats, skill bodies,
                hook outputs, and <code>&lt;system-reminder&gt;</code> blocks the CLI
                inserts. Click the <code>+N system</code> badge on a row to expand,
                or toggle <i>Show system injections</i> to expand all.
              </span>
            </Item>
            <Item>
              <RowSwatch kind="turn" />
              <span>
                <b>Assistant turn</b> — one model response, including any tool
                calls it made before replying.
              </span>
            </Item>
            <Item>
              <span style={{ color: "var(--muted)" }} className="text-xs">
                Note: sub-agent (sidechain) messages are filtered from this timeline
                — sub-agents appear as a tag on their parent turn instead.
              </span>
            </Item>
          </Section>

          <Section title="Token bars (per turn)">
            <Item>
              <ColorSwatch color="var(--muted)" />
              <span>
                <b>ctx bar</b> — total tokens this turn (incl. replayed cache).
                Bars grow naturally as the session gets longer; not a sign the
                turn did more work.
              </span>
            </Item>
            <Item>
              <ColorSwatch color="var(--accent)" />
              <span>
                <b>work bar</b> — only new tokens produced (output + cache-creation).
                Use this to spot turns that actually did heavy lifting.
              </span>
            </Item>
            <div className="flex flex-wrap gap-3 pl-6 pt-1">
              <Swatch label="cache-read" color={TOKEN_COLORS.cacheRead} />
              <Swatch label="cache-creation" color={TOKEN_COLORS.cacheCreate} />
              <Swatch label="input" color={TOKEN_COLORS.input} />
              <Swatch label="output" color={TOKEN_COLORS.output} />
            </div>
          </Section>

          <Section title="Tool tags">
            <div className="flex flex-wrap gap-2">
              <TagDemo color="#0ea5e9" label="tool" hint="Built-in tools (Read, Edit, Bash…)" />
              <TagDemo color="#a855f7" label="mcp" hint="MCP server tools (mcp__*)" />
              <TagDemo color="var(--positive)" label="skill" hint="Skill invocations" />
              <TagDemo color="var(--warning)" label="sub_agent" hint="Spawned sub-agents (Task tool)" />
              <TagDemo color="var(--accent)" label="parallel" hint="Shown when a turn emits >1 tool_use block in one message — they run concurrently." />
            </div>
          </Section>

          <Section title="Execution order">
            <Item>
              <span style={{ color: "var(--muted)" }}>
                Tool chips inside a turn are listed in the order the model emitted
                them, <b>not</b> a sequential gantt. Multiple tool_use blocks within
                one assistant message run in parallel (Claude Code executes them
                concurrently); the JSONL only records one timestamp for the whole
                batch, so per-tool durations are not shown. The turn&apos;s
                wall-clock duration already reflects the parallel batch.
                Sub-agents (Task tool) execute in their own session file —
                their internal timing is not part of this view.
              </span>
            </Item>
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--muted)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 leading-snug">{children}</div>;
}

function RowSwatch({ kind }: { kind: "human" | "slash" | "system" | "turn" }) {
  const bg =
    kind === "human"
      ? "color-mix(in srgb, #0ea5e9 25%, transparent)"
      : kind === "slash"
        ? "color-mix(in srgb, #f59e0b 25%, transparent)"
        : kind === "system"
          ? "color-mix(in srgb, var(--muted) 20%, transparent)"
          : "transparent";
  return (
    <span
      className="inline-block w-4 h-4 rounded shrink-0 mt-0.5 border"
      style={{ background: bg, borderColor: kind === "turn" ? "var(--border)" : "transparent" }}
    />
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-4 h-2 rounded shrink-0 mt-1.5"
      style={{ background: color }}
    />
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ background: color }}
      />
      <span style={{ color: "var(--muted)" }}>{label}</span>
    </span>
  );
}

function TagDemo({
  color,
  label,
  hint,
}: {
  color: string;
  label: string;
  hint: string;
}) {
  return (
    <span
      className="tag cursor-help"
      style={{ color, borderColor: color }}
      title={hint}
    >
      {label}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
