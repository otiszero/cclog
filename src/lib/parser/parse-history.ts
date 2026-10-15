import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { HistoryEntry, HistoryEntryKind } from "@/lib/types";
import { historyFile } from "./claude-home";
import { encodeProjectSlug } from "./encode-project-path";

type RawHistoryRow = {
  display?: unknown;
  pastedContents?: unknown;
  timestamp?: unknown;
  project?: unknown;
  sessionId?: unknown;
};

// Derive command + namespace from a slash-command display string.
// "/ck:cook some args" -> { command: "/ck:cook", namespace: "ck" }
// "/clear"             -> { command: "/clear", namespace: undefined }
function deriveCommand(display: string): { command: string; namespace?: string } {
  const command = display.split(/\s+/, 1)[0]; // first whitespace-delimited token
  const colon = command.indexOf(":");
  // namespace lives between the leading "/" and the first ":"
  const namespace = colon > 1 ? command.slice(1, colon) : undefined;
  return { command, namespace };
}

// Sum the character length of any pasted content blocks attached to a row.
function pasteCharCount(pasted: unknown): number {
  if (!pasted || typeof pasted !== "object") return 0;
  let chars = 0;
  for (const v of Object.values(pasted as Record<string, unknown>)) {
    const content = (v as { content?: unknown })?.content;
    if (typeof content === "string") chars += content.length;
  }
  return chars;
}

function toEntry(row: RawHistoryRow): HistoryEntry | null {
  const display = typeof row.display === "string" ? row.display : null;
  const ts =
    typeof row.timestamp === "number" && Number.isFinite(row.timestamp)
      ? row.timestamp
      : null;
  if (display === null || ts === null) return null; // unusable row

  const project = typeof row.project === "string" ? row.project : "";
  const sessionId = typeof row.sessionId === "string" ? row.sessionId : "";
  const kind: HistoryEntryKind = display.startsWith("/") ? "command" : "prompt";
  const { command, namespace } =
    kind === "command" ? deriveCommand(display) : { command: undefined, namespace: undefined };
  const hasPaste =
    !!row.pastedContents &&
    typeof row.pastedContents === "object" &&
    Object.keys(row.pastedContents as object).length > 0;

  return {
    ts,
    kind,
    display,
    command,
    namespace,
    projectPath: project,
    projectSlug: project ? encodeProjectSlug(project) : "",
    sessionId,
    hasPaste,
    promptChars: display.length + pasteCharCount(row.pastedContents),
  };
}

// Stream-parse ~/.claude/history.jsonl into typed entries. Defensive against
// schema drift: every line wrapped in try/catch, unusable rows skipped + counted.
// Returns { entries, skipped } so callers get an exact malformed-line tally.
export async function parseHistory(): Promise<{ entries: HistoryEntry[]; skipped: number }> {
  const entries: HistoryEntry[] = [];
  let skipped = 0;

  const stream = createReadStream(historyFile(), { encoding: "utf8" });
  // createReadStream defers ENOENT to an async 'error' event; attaching a
  // handler prevents an unhandled-rejection crash, but the async iterator below
  // still rejects on read errors — so the consuming loop is wrapped too.
  stream.on("error", () => {});

  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = toEntry(JSON.parse(line) as RawHistoryRow);
        if (entry) entries.push(entry);
        else skipped++;
      } catch {
        skipped++; // malformed line
      }
    }
  } catch {
    // missing file or mid-read failure → return whatever parsed so far
    return { entries, skipped };
  }
  return { entries, skipped };
}
