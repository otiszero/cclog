import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Bookmark } from "@/lib/types";
import { bookmarksFile, cclogDataDir } from "@/lib/parser/claude-home";

// Serializes all read-modify-write mutations in this process so two concurrent
// toggles (e.g. rapid clicks on different rows, or two tabs) can't each read the
// same base list and clobber each other's change (last-writer-wins data loss).
let writeChain: Promise<unknown> = Promise.resolve();
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Persisted shape. label is optional/forward-compatible (no edit UI yet).
const bookmarkSchema = z.object({
  slug: z.string(),
  sessionId: z.string(),
  label: z.string().optional(),
  createdAt: z.string(),
});
const bookmarksSchema = z.array(bookmarkSchema);

const sameKey = (b: Bookmark, slug: string, sessionId: string) =>
  b.slug === slug && b.sessionId === sessionId;

// Read all bookmarks. Missing file, invalid JSON, or schema mismatch all
// degrade to an empty list — the UI must never crash on a corrupt store.
export async function readBookmarks(): Promise<Bookmark[]> {
  let raw: string;
  try {
    raw = await readFile(bookmarksFile(), "utf8");
  } catch {
    return []; // ENOENT and friends → no bookmarks yet
  }
  try {
    const parsed = bookmarksSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return []; // malformed JSON
  }
}

export async function isBookmarked(slug: string, sessionId: string): Promise<boolean> {
  const list = await readBookmarks();
  return list.some((b) => sameKey(b, slug, sessionId));
}

// Atomic replace: write a uniquely-named temp file then rename over the target,
// so a crash mid-write can never leave a half-written store and concurrent
// writers never share (and interleave into) the same temp file.
async function writeBookmarks(list: Bookmark[]): Promise<void> {
  await mkdir(cclogDataDir(), { recursive: true });
  const tmp = `${bookmarksFile()}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await rename(tmp, bookmarksFile());
}

// Toggle a session's bookmark. Returns the new state (true = now bookmarked).
// The read-modify-write runs under the process write lock.
export async function toggleBookmark(slug: string, sessionId: string): Promise<boolean> {
  return withWriteLock(async () => {
    const list = await readBookmarks();
    const exists = list.some((b) => sameKey(b, slug, sessionId));
    if (exists) {
      await writeBookmarks(list.filter((b) => !sameKey(b, slug, sessionId)));
      return false;
    }
    list.push({ slug, sessionId, createdAt: new Date().toISOString() });
    await writeBookmarks(list);
    return true;
  });
}
