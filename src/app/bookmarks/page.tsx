import Link from "next/link";
import { join } from "node:path";
import { projectsDir } from "@/lib/parser/claude-home";
import { getParsedSession } from "@/lib/parser/cache";
import { readProjectCwd } from "@/lib/parser/read-project-cwd";
import { decodeProjectSlug } from "@/lib/parser/decode-project-path";
import {
  estimateSessionCost,
  modelsUsed,
  sumTokens,
  totalTokens,
} from "@/lib/parser/derive-metrics";
import { readBookmarks } from "@/lib/bookmarks/bookmarks-store";
import { BookmarkToggle } from "@/components/session/bookmark-toggle";
import { EmptyState } from "@/components/common/empty-state";
import { formatCost, formatRelative, formatTokens } from "@/lib/format";
import type { BookmarkedSession } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const bookmarks = await readBookmarks();

  // Resolve each bookmark to session metadata via the mtime-keyed parse cache.
  // A missing file (deleted/rotated session) yields meta: null → stale row.
  const rows: BookmarkedSession[] = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const realPath =
        (await readProjectCwd(bookmark.slug)) ?? decodeProjectSlug(bookmark.slug);
      const file = join(projectsDir(), bookmark.slug, `${bookmark.sessionId}.jsonl`);
      let meta: BookmarkedSession["meta"] = null;
      try {
        const parsed = await getParsedSession(file, bookmark.slug);
        if (parsed) {
          meta = {
            startedAt: parsed.startedAt,
            tokens: sumTokens(totalTokens(parsed.events)),
            estCostUsd: estimateSessionCost(parsed.events),
            models: modelsUsed(parsed.events),
          };
        }
      } catch {
        /* stale bookmark — session file no longer exists */
      }
      return { bookmark, realPath, meta };
    }),
  );

  // Newest bookmark first.
  rows.sort((a, b) => b.bookmark.createdAt.localeCompare(a.bookmark.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {rows.length === 0
            ? "No bookmarked sessions yet"
            : `${rows.length} bookmarked session${rows.length === 1 ? "" : "s"}`}
        </p>
      </header>

      <section className="card">
        {rows.length === 0 ? (
          <EmptyState
            title="No bookmarks yet"
            hint="Star a session from its page or the project session list to pin it here for quick access."
          />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th aria-label="Bookmark" className="w-8" />
                <th>Project</th>
                <th>Started</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Cost</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bookmark, realPath, meta }) => (
                <tr key={`${bookmark.slug}/${bookmark.sessionId}`}>
                  <td className="text-center">
                    <BookmarkToggle
                      slug={bookmark.slug}
                      sessionId={bookmark.sessionId}
                      initialBookmarked
                      size={16}
                    />
                  </td>
                  <td className="truncate max-w-[280px]" title={realPath}>
                    <Link href={`/project/${encodeURIComponent(bookmark.slug)}`}>{realPath}</Link>
                  </td>
                  <td>
                    {meta ? (
                      formatRelative(meta.startedAt)
                    ) : (
                      <span style={{ color: "var(--muted)" }}>session file missing</span>
                    )}
                  </td>
                  <td className="text-right">{meta ? formatTokens(meta.tokens) : "—"}</td>
                  <td className="text-right">{meta ? formatCost(meta.estCostUsd) : "—"}</td>
                  <td>
                    <Link
                      href={`/project/${encodeURIComponent(bookmark.slug)}/session/${bookmark.sessionId}`}
                      className="font-mono text-xs"
                    >
                      {bookmark.sessionId.slice(0, 8)}…
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
