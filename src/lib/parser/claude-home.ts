import { homedir } from "node:os";
import { join } from "node:path";

export function claudeHome(): string {
  return process.env.CLAUDE_HOME ?? join(homedir(), ".claude");
}

export function projectsDir(): string {
  return join(claudeHome(), "projects");
}
