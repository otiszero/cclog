import { homedir } from "node:os";
import { join } from "node:path";

export function claudeHome(): string {
  return process.env.CLAUDE_HOME ?? join(homedir(), ".claude");
}

export function projectsDir(): string {
  return join(claudeHome(), "projects");
}

export function historyFile(): string {
  return join(claudeHome(), "history.jsonl");
}

export function rulesDir(): string {
  return join(claudeHome(), "rules");
}

export function globalMemoryDir(): string {
  return join(claudeHome(), "memory");
}

// The new per-project memory system stores files under projects/<slug>/memory/.
export function projectMemoryDir(slug: string): string {
  return join(projectsDir(), slug, "memory");
}
