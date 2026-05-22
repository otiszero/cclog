import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { projectsDir } from "./claude-home";

const cache = new Map<string, string | null>();
const MAX_LINES = 20;

// Claude writes the literal absolute cwd on every JSONL entry. Reading it
// directly is more reliable than reversing the lossy slug encoding.
export async function readProjectCwd(slug: string): Promise<string | null> {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  const result = await readCwdFromDisk(slug);
  cache.set(slug, result);
  return result;
}

async function readCwdFromDisk(slug: string): Promise<string | null> {
  const dir = join(projectsDir(), slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;

  // Prefer the newest JSONL — most likely to reflect current cwd if anything
  // ever differed (in practice slug↔cwd is 1:1, but newest is safest).
  let newest: { name: string; mtime: number } | null = null;
  for (const name of files) {
    try {
      const st = await stat(join(dir, name));
      if (!newest || st.mtimeMs > newest.mtime) {
        newest = { name, mtime: st.mtimeMs };
      }
    } catch {
      /* skip */
    }
  }
  if (!newest) return null;

  const filePath = join(dir, newest.name);
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let scanned = 0;
    let resolved = false;
    const finish = (val: string | null) => {
      if (resolved) return;
      resolved = true;
      rl.close();
      stream.destroy();
      resolve(val);
    };
    rl.on("line", (line) => {
      if (resolved) return;
      scanned++;
      if (line.trim()) {
        try {
          const obj = JSON.parse(line) as { cwd?: unknown };
          if (typeof obj.cwd === "string" && obj.cwd.length > 0) {
            finish(obj.cwd);
            return;
          }
        } catch {
          /* malformed line — keep scanning */
        }
      }
      if (scanned >= MAX_LINES) finish(null);
    });
    rl.on("close", () => finish(null));
    stream.on("error", () => finish(null));
  });
}
