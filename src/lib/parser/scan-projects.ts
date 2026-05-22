import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectDir } from "@/lib/types";
import { projectsDir } from "./claude-home";
import { decodeProjectSlug } from "./decode-project-path";
import { readProjectCwd } from "./read-project-cwd";

export async function listProjects(): Promise<ProjectDir[]> {
  const root = projectsDir();
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  const out: ProjectDir[] = [];
  for (const slug of entries) {
    const dir = join(root, slug);
    let st;
    try {
      st = await stat(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    let lastModified = 0;
    for (const f of files) {
      try {
        const fst = await stat(join(dir, f));
        if (fst.mtimeMs > lastModified) lastModified = fst.mtimeMs;
      } catch {
        /* ignore */
      }
    }
    const cwd = await readProjectCwd(slug);
    out.push({
      slug,
      realPath: cwd ?? decodeProjectSlug(slug),
      sessionCount: files.length,
      lastModified,
    });
  }
  out.sort((a, b) => b.lastModified - a.lastModified);
  return out;
}

export async function listSessionFiles(slug: string): Promise<string[]> {
  const dir = join(projectsDir(), slug);
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".jsonl")).map((f) => join(dir, f));
  } catch {
    return [];
  }
}
