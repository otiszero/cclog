// Claude Code stores per-project session dirs under ~/.claude/projects/
// using a flat-encoded representation of the absolute cwd path, where
// every "/" is replaced by "-". Re-decoding is heuristic because real
// names may legitimately contain "-".
//
// Strategy: split on "-", then greedily probe filesystem starting from "/"
// to find the longest prefix that exists. Whatever doesn't exist on disk
// gets joined back with "-". This is best-effort; we still return a
// reasonable string even when the path no longer exists.
import { existsSync } from "node:fs";
import { join } from "node:path";

export function decodeProjectSlug(slug: string): string {
  if (!slug.startsWith("-")) return slug;
  const parts = slug.slice(1).split("-");
  let cur = "/";
  let i = 0;
  while (i < parts.length) {
    // try to extend cur by joining 1..N parts back together with "-"
    let matched = 0;
    for (let take = parts.length - i; take >= 1; take--) {
      const candidate = join(cur, parts.slice(i, i + take).join("-"));
      if (existsSync(candidate)) {
        cur = candidate;
        matched = take;
        break;
      }
    }
    if (matched === 0) {
      // no fs match — fall back to single segment per dash
      cur = join(cur, parts[i]);
      matched = 1;
    }
    i += matched;
  }
  return cur;
}
