import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ParsedSession, RiskHit, RiskTag, SessionEvent } from "@/lib/types";
import { claudeHome } from "./claude-home";

// Built-in defaults. Each tag has one or more regex patterns; a tool_use is
// flagged if any pattern matches any "interesting" string in its input.
// Patterns are intentionally conservative — false positives are cheap (just a
// flag in a panel), false negatives are what we care about.
const DEFAULT_RULES: Record<RiskTag, { tools: string[]; patterns: RegExp[] }> = {
  destructive_bash: {
    tools: ["Bash"],
    patterns: [
      /\brm\s+-rf?\b/i,
      /\bgit\s+push\b[^|;&]*--force\b/i,
      /\bgit\s+push\b[^|;&]*-f\b(?!orce-with-lease)/i,
      /\bgit\s+reset\s+--hard\b/i,
      /\bgit\s+clean\s+-[a-z]*f/i,
      /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i,
      /\bchmod\s+777\b/,
      /\bmkfs(\.[a-z0-9]+)?\b/i,
      /\bdd\s+if=\S+\s+of=\/dev\//i,
      /--no-verify\b/,
    ],
  },
  sensitive_read: {
    tools: ["Read", "Bash", "Glob", "Grep"],
    patterns: [
      /(^|\/|\\)\.env(\.|$|\s|"|')/,
      /\bid_(rsa|ed25519|ecdsa|dsa)\b/,
      /\.pem(\s|"|'|$)/,
      /\.p12\b/,
      /credentials?\.(json|yaml|yml|toml|ini)\b/i,
      /(^|\/)\.aws\/credentials\b/,
      /(^|\/)\.ssh\/(?!known_hosts|config)/,
      /\bkeystore\.jks\b/,
    ],
  },
  network_egress: {
    tools: ["Bash"],
    patterns: [
      /\b(curl|wget|http|fetch)\s+[^|;&]*https?:\/\//i,
      /\bnpm\s+publish\b/,
      /\bpnpm\s+publish\b/,
      /\bgh\s+(pr|issue|api)\b/,
    ],
  },
  write_outside_cwd: {
    tools: ["Write", "Edit", "MultiEdit"],
    patterns: [
      /^\/etc\//,
      /^\/usr\//,
      /^\/var\//,
      /^\/System\//,
      /^\/Library\//,
      /^~\/\.ssh\//,
      /^~\/\.aws\//,
    ],
  },
};

type UserConfig = {
  risk?: {
    disable?: string[]; // tag names to drop from defaults
    extend?: Record<string, string[]>; // tag → extra regex source strings
  };
  recommendations?: { dismissed?: string[] };
};

let cachedConfig: UserConfig | null | undefined; // undefined = unread, null = no file
function loadConfig(): UserConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;
  try {
    const path = join(claudeHome(), "cclog.config.json");
    const raw = readFileSync(path, "utf8");
    cachedConfig = JSON.parse(raw) as UserConfig;
  } catch {
    cachedConfig = null;
  }
  return cachedConfig;
}

// Exposed so a future /settings page can show "active tags / source".
export function effectiveRules(): { tag: string; tools: string[]; patterns: RegExp[]; source: "default" | "user" }[] {
  const cfg = loadConfig();
  const disabled = new Set(cfg?.risk?.disable ?? []);
  const out: { tag: string; tools: string[]; patterns: RegExp[]; source: "default" | "user" }[] = [];
  for (const [tag, def] of Object.entries(DEFAULT_RULES)) {
    if (disabled.has(tag)) continue;
    const extras = cfg?.risk?.extend?.[tag] ?? [];
    const patterns = [...def.patterns, ...extras.map((s) => safeRegex(s)).filter(Boolean) as RegExp[]];
    out.push({ tag, tools: def.tools, patterns, source: "default" });
  }
  // Pure user-defined tags (not in defaults)
  for (const [tag, sources] of Object.entries(cfg?.risk?.extend ?? {})) {
    if (tag in DEFAULT_RULES) continue;
    const patterns = sources.map((s) => safeRegex(s)).filter(Boolean) as RegExp[];
    if (patterns.length === 0) continue;
    out.push({ tag, tools: [], patterns, source: "user" }); // empty tools = match any tool
  }
  return out;
}

function safeRegex(src: string): RegExp | null {
  try {
    return new RegExp(src, "i");
  } catch {
    return null;
  }
}

// Pull strings worth scanning out of a tool_use input.
function relevantStrings(toolName: string, input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  const i = input as Record<string, unknown>;
  const out: string[] = [];
  for (const key of ["command", "file_path", "path", "pattern", "url"]) {
    const v = i[key];
    if (typeof v === "string") out.push(v);
  }
  // MultiEdit: edits[].file_path
  if (toolName === "MultiEdit" && Array.isArray(i.edits)) {
    for (const e of i.edits) {
      if (e && typeof e === "object" && typeof (e as { file_path?: string }).file_path === "string") {
        out.push((e as { file_path: string }).file_path);
      }
    }
  }
  return out;
}

export function tagToolUse(
  toolUse: Extract<SessionEvent, { kind: "tool_use" }>,
): { tag: string; detail: string }[] {
  const rules = effectiveRules();
  const fields = relevantStrings(toolUse.name, toolUse.input);
  if (fields.length === 0) return [];
  const hits: { tag: string; detail: string }[] = [];
  for (const rule of rules) {
    if (rule.tools.length > 0 && !rule.tools.includes(toolUse.name)) continue;
    for (const field of fields) {
      for (const re of rule.patterns) {
        const m = re.exec(field);
        if (m) {
          hits.push({ tag: rule.tag, detail: m[0].slice(0, 120) });
          break; // one match per rule per field is enough
        }
      }
    }
  }
  // Dedupe (tag, detail)
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.tag}::${h.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Risky hits across a session. `guarded` is true when a PreToolUse:<Tool> hook
// fired against the same toolUseID (i.e. a guardrail saw this call).
export function riskHitsForSession(parsed: ParsedSession): RiskHit[] {
  const guardedToolUseIds = new Set<string>();
  for (const e of parsed.events) {
    if (e.kind !== "hook") continue;
    if (e.hookEvent !== "PreToolUse") continue;
    if (e.toolUseId) guardedToolUseIds.add(e.toolUseId);
  }
  const hits: RiskHit[] = [];
  for (const e of parsed.events) {
    if (e.kind !== "tool_use") continue;
    const tags = tagToolUse(e);
    for (const t of tags) {
      hits.push({
        tag: t.tag,
        toolUseUuid: e.uuid,
        toolName: e.name,
        ts: e.ts,
        detail: t.detail,
        guarded: guardedToolUseIds.has(e.uuid),
      });
    }
  }
  return hits;
}

export function dismissedRecommendations(): Set<string> {
  return new Set(loadConfig()?.recommendations?.dismissed ?? []);
}
