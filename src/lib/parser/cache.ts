import { stat } from "node:fs/promises";
import type { ParsedSession } from "@/lib/types";
import { parseSession } from "./parse-session";

type CacheEntry = { mtimeMs: number; parsed: ParsedSession };

const MAX_ENTRIES = 50;
const cache = new Map<string, CacheEntry>(); // insertion order = LRU order

export async function getParsedSession(
  filePath: string,
  projectSlug: string,
): Promise<ParsedSession> {
  const st = await stat(filePath);
  const existing = cache.get(filePath);
  if (existing && existing.mtimeMs === st.mtimeMs) {
    // bump LRU
    cache.delete(filePath);
    cache.set(filePath, existing);
    return existing.parsed;
  }
  const parsed = await parseSession(filePath, projectSlug);
  cache.set(filePath, { mtimeMs: st.mtimeMs, parsed });
  if (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  return parsed;
}

// expose for tests / debugging
export function clearCache() {
  cache.clear();
}
