"use server";
import { buildPromptIndex, type PromptDoc } from "@/lib/parser/build-prompt-index";

export async function searchPrompts(query: string): Promise<PromptDoc[]> {
  const q = query.trim();
  if (!q) return [];
  const { fuse } = await buildPromptIndex();
  return fuse.search(q, { limit: 50 }).map((r) => r.item);
}
