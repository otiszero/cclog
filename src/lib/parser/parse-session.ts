import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import type { ParsedSession, SessionEvent, ToolUseRef } from "@/lib/types";
import { categorizeTool } from "./categorize-tool";

// Stream-parse a jsonl session log. Defensive against schema drift:
// every line wrapped in try/catch, unknown types ignored, malformed lines counted.
export async function parseSession(
  filePath: string,
  projectSlug: string,
): Promise<ParsedSession> {
  const sessionId = basename(filePath, ".jsonl");
  const events: SessionEvent[] = [];
  let skippedLines = 0;
  let startedAt: string | undefined;
  let endedAt: string | undefined;

  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  // index assistant turns by uuid so subsequent tool_use blocks (which live
  // inside the same line) can be attached, plus tool_result blocks (separate
  // user lines) can be linked back via tool_use_id
  const turnByUuid = new Map<string, Extract<SessionEvent, { kind: "turn" }>>();
  const toolUseById = new Map<string, Extract<SessionEvent, { kind: "tool_use" }>>();

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const ts: string | undefined = entry.timestamp;
      if (ts) {
        if (!startedAt) startedAt = ts;
        endedAt = ts;
      }

      switch (entry.type) {
        case "user": {
          const content = entry.message?.content;
          // user prompt: string content, or content array with text blocks
          if (typeof content === "string") {
            events.push({ kind: "user_prompt", ts: ts ?? "", uuid: entry.uuid ?? "", text: content, raw: entry });
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block?.type === "text" && typeof block.text === "string") {
                events.push({
                  kind: "user_prompt",
                  ts: ts ?? "",
                  uuid: entry.uuid ?? "",
                  text: block.text,
                  raw: entry,
                });
              } else if (block?.type === "tool_result") {
                const ref = toolUseById.get(block.tool_use_id);
                if (ref) {
                  ref.resultOk = block.is_error !== true;
                  ref.resultPreview = stringifyPreview(block.content);
                  ref.resultFull = stringifyFull(block.content);
                }
              }
            }
          }
          break;
        }
        case "assistant": {
          const msg = entry.message;
          if (!msg) break;
          const usage = msg.usage ?? {};
          const turnUuid = entry.uuid ?? msg.id ?? Math.random().toString(36);
          const toolUseRefs: ToolUseRef[] = [];
          let textBuf = "";
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block?.type === "text" && typeof block.text === "string") {
                textBuf += (textBuf ? "\n" : "") + block.text;
              } else if (block?.type === "tool_use") {
                const tu: Extract<SessionEvent, { kind: "tool_use" }> = {
                  kind: "tool_use",
                  ts: ts ?? "",
                  uuid: block.id ?? "",
                  parentTurn: turnUuid,
                  name: block.name ?? "",
                  input: block.input,
                  raw: block,
                };
                events.push(tu);
                toolUseById.set(tu.uuid, tu);
                toolUseRefs.push({
                  name: tu.name,
                  category: categorizeTool(tu.name),
                  ts: tu.ts,
                  uuid: tu.uuid,
                });
                if (tu.name === "Task") {
                  const subAgentType =
                    (tu.input as { subagent_type?: string } | null)?.subagent_type ?? "unknown";
                  events.push({
                    kind: "sub_agent",
                    ts: ts ?? "",
                    parentTurn: turnUuid,
                    subAgentType,
                  });
                }
              }
            }
          }
          const turn: Extract<SessionEvent, { kind: "turn" }> = {
            kind: "turn",
            ts: ts ?? "",
            uuid: turnUuid,
            model: msg.model ?? "unknown",
            usage: {
              input: usage.input_tokens ?? 0,
              output: usage.output_tokens ?? 0,
              cacheRead: usage.cache_read_input_tokens ?? 0,
              cacheCreate: usage.cache_creation_input_tokens ?? 0,
            },
            text: textBuf,
            toolUses: toolUseRefs,
            raw: entry,
          };
          events.push(turn);
          turnByUuid.set(turnUuid, turn);
          break;
        }
        case "system":
          if (entry.subtype) {
            events.push({ kind: "system", ts: ts ?? "", subtype: String(entry.subtype) });
          }
          break;
        default:
          // ignore attachment, permission-mode, file-history-snapshot, etc.
          break;
      }
    } catch {
      skippedLines++;
    }
  }

  // derive duration per turn (delta to next turn timestamp)
  const turnEvents = events.filter((e) => e.kind === "turn") as Extract<
    SessionEvent,
    { kind: "turn" }
  >[];
  for (let i = 0; i < turnEvents.length - 1; i++) {
    const a = turnEvents[i];
    const b = turnEvents[i + 1];
    if (a.ts && b.ts) {
      a.durationMs = Math.max(0, Date.parse(b.ts) - Date.parse(a.ts));
    }
  }

  return { sessionId, filePath, projectSlug, events, startedAt, endedAt, skippedLines };
}

function stringifyPreview(content: unknown): string {
  return stringifyContent(content).slice(0, 400);
}

const FULL_CAP = 200_000;
function stringifyFull(content: unknown): string {
  return stringifyContent(content).slice(0, FULL_CAP);
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === "object" && b && "text" in b ? (b as { text: string }).text : ""))
      .join("\n");
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return "";
  }
}
