"use client";

import { useState, useTransition } from "react";
import { toggleBookmarkAction } from "@/app/bookmarks/actions";

// Star toggle for pinning a session. Optimistic: flips immediately, then
// reconciles to the server's authoritative state (or reverts on error).
export function BookmarkToggle({
  slug,
  sessionId,
  initialBookmarked,
  size = 18,
}: {
  slug: string;
  sessionId: string;
  initialBookmarked: boolean;
  size?: number;
}) {
  const [on, setOn] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      try {
        setOn(await toggleBookmarkAction(slug, sessionId));
      } catch {
        setOn(!next); // revert on failure
      }
    });
  }

  // Include a short session id so screen-reader users can tell rows apart when
  // many toggles share a table column.
  const shortId = sessionId.slice(0, 8);
  const label = on ? `Remove bookmark for session ${shortId}` : `Bookmark session ${shortId}`;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-md p-1 transition-colors"
      style={{ color: on ? "var(--accent)" : "var(--foreground-muted)", cursor: "pointer" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      </svg>
    </button>
  );
}
