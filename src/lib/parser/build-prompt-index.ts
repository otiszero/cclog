import Fuse from "fuse.js";
import { listProjects, listSessionFiles } from "./scan-projects";
import { getParsedSession } from "./cache";
import { estimateCost } from "@/lib/pricing";

export type PromptDoc = {
  projectSlug: string;
  realPath: string;
  sessionId: string;
  ts: string;
  text: string;
  responseSnippet: string;
  model: string;
  tokens: number;
  cost: number;
};

const TTL_MS = 5 * 60_000;
let cached: { at: number; fuse: Fuse<PromptDoc>; docs: PromptDoc[] } | null = null;

export async function buildPromptIndex() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  const docs: PromptDoc[] = [];
  const projects = await listProjects();
  for (const p of projects) {
    const files = await listSessionFiles(p.slug);
    for (const f of files) {
      try {
        const parsed = await getParsedSession(f, p.slug);
        let pendingPrompt: { ts: string; text: string; rank: number } | null = null;
        for (const e of parsed.events) {
          if (e.kind === "user_prompt") {
            const rank =
              e.source === "human" ? 3 : e.source === "slash_command" ? 2 : 0;
            if (rank === 0) continue;
            if (!pendingPrompt || rank > pendingPrompt.rank) {
              pendingPrompt = { ts: e.ts, text: e.text, rank };
            }
          } else if (e.kind === "turn" && pendingPrompt) {
            const tokens =
              e.usage.input + e.usage.output + e.usage.cacheRead + e.usage.cacheCreate;
            docs.push({
              projectSlug: p.slug,
              realPath: p.realPath,
              sessionId: parsed.sessionId,
              ts: pendingPrompt.ts,
              text: pendingPrompt.text,
              responseSnippet: e.text.slice(0, 200),
              model: e.model,
              tokens,
              cost: estimateCost(e.model, e.usage),
            });
            pendingPrompt = null;
          }
        }
      } catch {
        /* ignore parse errors */
      }
    }
  }
  const fuse = new Fuse(docs, {
    keys: ["text", "responseSnippet"],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  cached = { at: Date.now(), fuse, docs };
  return cached;
}
