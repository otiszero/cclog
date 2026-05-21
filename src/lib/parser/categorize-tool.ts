import type { ToolCategory } from "@/lib/types";

export function categorizeTool(name: string): ToolCategory {
  if (!name) return "tool";
  if (name.startsWith("mcp__")) return "mcp";
  if (name === "Skill") return "skill";
  if (name === "Task") return "sub_agent";
  return "tool";
}

// Pull a human-readable label for skills/sub-agents from tool input
export function toolDisplayName(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return name;
  const obj = input as Record<string, unknown>;
  if (name === "Skill" && typeof obj.skill === "string") return `Skill: ${obj.skill}`;
  if (name === "Task" && typeof obj.subagent_type === "string") return `Agent: ${obj.subagent_type}`;
  if (name.startsWith("mcp__")) {
    // mcp__server__tool → server/tool
    const parts = name.split("__");
    if (parts.length >= 3) return `MCP: ${parts[1]}/${parts.slice(2).join("__")}`;
  }
  return name;
}
