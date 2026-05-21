export type TokenUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
};

export type SessionEvent =
  | {
      kind: "turn";
      ts: string;
      uuid: string;
      model: string;
      usage: TokenUsage;
      text: string;
      toolUses: ToolUseRef[];
      durationMs?: number;
    }
  | { kind: "user_prompt"; ts: string; uuid: string; text: string }
  | {
      kind: "tool_use";
      ts: string;
      uuid: string;
      parentTurn: string;
      name: string;
      input: unknown;
      resultPreview?: string;
      resultOk?: boolean;
    }
  | {
      kind: "sub_agent";
      ts: string;
      parentTurn: string;
      subAgentType: string;
      childSessionId?: string;
    }
  | { kind: "system"; ts: string; subtype: string };

export type ToolUseRef = {
  name: string;
  category: ToolCategory;
  ts: string;
  uuid: string;
};

export type ToolCategory = "tool" | "mcp" | "skill" | "sub_agent";

export type ParsedSession = {
  sessionId: string;
  filePath: string;
  projectSlug: string;
  events: SessionEvent[];
  startedAt?: string;
  endedAt?: string;
  skippedLines: number;
};

export type ProjectDir = {
  slug: string; // flat encoded dir name
  realPath: string; // decoded cwd path
  sessionCount: number;
  lastModified: number; // epoch ms
};

export type SessionMeta = {
  sessionId: string;
  filePath: string;
  projectSlug: string;
  startedAt?: string;
  endedAt?: string;
  turnCount: number;
  totalTokens: TokenUsage;
  models: string[];
  estCostUsd: number;
  fileBytes: number;
};

export type LeaderboardRow = {
  key: string;
  count: number;
  tokens: TokenUsage;
  estCostUsd: number;
};

export type ProjectSummary = {
  slug: string;
  realPath: string;
  sessionCount: number;
  lifetimeTokens: TokenUsage;
  estCostUsd: number;
  lastActive?: string;
  byTool: LeaderboardRow[];
  byMcp: LeaderboardRow[];
  bySkill: LeaderboardRow[];
  bySubAgent: LeaderboardRow[];
  dailyTokens: { date: string; tokens: number; cost: number }[];
  sessions: SessionMeta[];
};
