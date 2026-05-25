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
      raw?: unknown;
    }
  | {
      kind: "user_prompt";
      ts: string;
      uuid: string;
      text: string;
      source: UserPromptSource;
      promptId?: string;
      raw?: unknown;
    }
  | {
      kind: "tool_use";
      ts: string;
      uuid: string;
      parentTurn: string;
      name: string;
      input: unknown;
      resultPreview?: string;
      resultFull?: string;
      resultOk?: boolean;
      raw?: unknown;
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

export type UserPromptSource = "human" | "slash_command" | "system_injection" | "sidechain";

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
  efficiency: EfficiencyReport;
};

export type EfficiencyGrade = "A" | "B" | "C" | "D" | "F" | "N/A";

export type EfficiencyReport = {
  score: number; // 0-100
  grade: EfficiencyGrade;
  cacheHitRate: number; // 0-1; cacheRead / (cacheRead + input)
  reReadWaste: number; // 0-1; repeated reads / total reads
  toolBloat: number; // 0-1; big tool outputs / all tool outputs
  totalReads: number;
  totalTools: number;
  findings: AntiPatternFinding[];
  wastedCostUsd: number; // marginal (cache-aware) USD across all findings
  wastedCostUpperUsd: number; // upper bound: same tokens priced as fresh input
  wastedCostBreakdown: { reReadUsd: number; bloatUsd: number };
};

export type AntiPatternKind = "re_grep_loop" | "tool_output_explosion";

export type AntiPatternFinding = {
  kind: AntiPatternKind;
  // For re_grep_loop: the repeated file path; for tool_output_explosion: the tool name + size
  label: string;
  // Wasted/bloated bytes or repeat count for context
  detail: string;
  // Turn UUIDs flagged by this finding
  turnUuids: string[];
  // Rich detail per kind (one of these is set)
  reReadDetail?: ReReadDetail;
  bloatDetail?: BloatDetail;
};

export type ReReadReason =
  | "first_read"
  | "duplicate_same_batch"
  | "re_verify_after_edit"
  | "after_sub_agent"
  | "context_drift"
  | "unknown";

export type ReReadDetail = {
  filePath: string;
  reads: {
    ts: string;
    turnUuid: string;
    reason: ReReadReason;
    chars: number; // tool_result size returned to Claude
    wastedCostUsd: number; // 0 for first_read; cache-aware marginal $
    wastedCostUpperUsd: number; // priced as fresh input
  }[];
};

export type BloatDetail = {
  toolName: string;
  inputSummary: string; // short label of input (file path / command)
  resultChars: number;
  estTokens: number; // ~chars/4
  turnsAfter: number; // # turns this stayed in cache for subsequent reads
  estCarriedTokens: number; // est extra cached-input tokens caused
  model: string; // model on the owner turn — used for pricing
  wastedCostUsd: number; // cacheCreate + turnsAfter × cacheRead
  wastedCostUpperUsd: number; // priced as fresh input across (turnsAfter + 1)
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
  efficiency: EfficiencyReport; // token-weighted across sessions
};
