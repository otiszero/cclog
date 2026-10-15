"use server";
import { revalidatePath } from "next/cache";
import { toggleBookmark } from "@/lib/bookmarks/bookmarks-store";

// Toggle a session bookmark and refresh every view that reflects its state.
// Removal is just a toggle-off, so this is the single mutation entry point.
export async function toggleBookmarkAction(
  slug: string,
  sessionId: string,
): Promise<boolean> {
  const state = await toggleBookmark(slug, sessionId);
  revalidatePath("/bookmarks");
  revalidatePath(`/project/${encodeURIComponent(slug)}`);
  revalidatePath(`/project/${encodeURIComponent(slug)}/session/${sessionId}`);
  return state;
}
