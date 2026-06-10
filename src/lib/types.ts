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
  | {
      kind: "hook";
      ts: string;
      hookEvent: string; // SessionStart | PreToolUse | PostToolUse | UserPromptSubmit | Stop | ...
      hookName: string;
      toolUseId?: string;
      contentKind: "success" | "additional_context";
      content: string;
      estTokens: number; // chars / 4
    }
  | { kind: "system"; ts: string; subtype: string };

export type ToolUseRef = {
  name: string;
  category: ToolCategory;
  ts: string;
  uuid: string;
};

export type ToolCategory = "tool" | "mcp" | "skill" | "sub_agent";

// Harness / risk taxonomy. Static defaults shipped in risk-tags.ts; user can
// disable any tag or extend with extra regex via ~/.claude/cclog.config.json.
export type RiskTag =
  | "destructive_bash"
  | "sensitive_read"
  | "network_egress"
  | "write_outside_cwd"
  | string; // user-defined tags allowed

export type RiskHit = {
  tag: RiskTag;
  toolUseUuid: string;
  toolName: string;
  ts: string;
  detail: string; // matched fragment / regex source
  guarded: boolean; // a PreToolUse:<Tool> hook fired against the same toolUseID
};

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
  // z-score of estCostUsd within this project's session population.
  // null when population < 4 sessions or std dev is 0.
  costAnomalyZ: number | null;
  // Harness signals — populated by aggregate layer.
  riskHitCount: number; // # risky tool calls (sum across tags)
  hookFireCount: number; // # hook events
  hookContextTokens: number; // estTokens injected via hook_additional_context
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
  // Per-turn (assistant) window pressure 0-1 = prompt_tokens / context_limit.
  // Indexed by turn order (only turn events, not prompts/tools).
  windowPressure: number[];
  maxWindowPressure: number;
  maxPressureTurn: number; // index into windowPressure; -1 if no turns
};

export type AntiPatternKind =
  | "re_grep_loop"
  | "tool_output_explosion"
  | "retry_loop"
  | "flailing_edit"
  | "lost_in_middle"
  | "should_have_compacted";

export type RetryLoopDetail = {
  toolName: string;
  inputSummary: string; // command / file_path / pattern
  attempts: number;
  failures: number;
};

export type FlailingEditDetail = {
  filePath: string;
  edits: number; // consecutive Edit/Write/MultiEdit
  failures: number; // resultOk === false
};

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
  retryDetail?: RetryLoopDetail;
  flailDetail?: FlailingEditDetail;
  lostInMiddleDetail?: LostInMiddleDetail;
  compactionDetail?: CompactionDetail;
};

export type LostInMiddleDetail = {
  toolName: string;
  inputSummary: string;
  sizeKB: number;
  positionPct: number; // 0-100; where in the cumulative prompt this output sits
};

export type CompactionDetail = {
  atTurn: number; // turn index (0-based)
  pressurePct: number; // 0-100
  model: string;
  contextLimit: number;
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
  harness: HarnessReport;
};

export type HarnessReport = {
  riskByTag: { tag: string; count: number; guarded: number }[];
  topRisky: { tag: string; toolName: string; detail: string; count: number; guarded: number }[];
  hookFires: { hookName: string; hookEvent: string; count: number; contextTokens: number }[];
  recommendations: HarnessRecommendation[];
};

export type HarnessRecommendation = {
  id: string; // stable id; used for dismiss list
  tag: string;
  toolName: string; // tool to gate (e.g. Bash, Read, Write)
  occurrences: number;
  guarded: number;
  samples: string[]; // up to 5 detail fragments matched
  // Two snippet flavours, ready to copy
  settingsJson: string;
  hookScript: string;
};

// --- Command & Workflow Analytics (history.jsonl) ---------------------------
// Sourced from ~/.claude/history.jsonl — every prompt + slash command typed.
// The only behavioral/workflow data source in the app.

export type HistoryEntryKind = "command" | "prompt";

export type HistoryEntry = {
  ts: number; // epoch ms
  kind: HistoryEntryKind;
  display: string;
  command?: string; // first token when kind === "command", e.g. "/ck:cook"
  namespace?: string; // part between leading "/" and ":" — "ck"; undefined for builtins
  projectPath: string; // full cwd as stored
  projectSlug: string; // every non-alphanumeric → "-" (Claude's flat-encode); see encode-project-path.ts
  sessionId: string;
  hasPaste: boolean;
  promptChars: number; // display length + summed paste content length
};

export type ActivityStats = {
  totalEntries: number;
  commandCount: number;
  promptCount: number;
  skipped: number; // malformed lines skipped during parse
  dateRange: { from: number; to: number };
  commandLeaderboard: { command: string; count: number; namespace?: string }[];
  heatmap: number[][]; // [7 weekdays, 0=Sun][24 hours] counts (local time)
  perProject: { slug: string; path: string; total: number; topCommand?: string }[];
  perProjectTruncated: number; // projects omitted beyond the display cap
  clearCadence: { clears: number; avgEntriesBetweenClears: number };
};

// --- Startup Context (CLAUDE.md + rules + memory injected at session start) ---
// Reconstructed from disk: the transcripts don't log the injected system prompt,
// so this reflects CURRENT file state, not a historical per-session snapshot.
// global-* sources are shared across every project; project-* are per-project.

export type InjectedCategory =
  | "global-instructions" // ~/.claude/CLAUDE.md
  | "global-rules" // ~/.claude/rules/*.md (harness auto-injects)
  | "global-memory" // ~/.claude/memory/*.md
  | "project-instructions" // <project>/CLAUDE.md (+ CLAUDE.local.md)
  | "project-memory"; // ~/.claude/projects/<slug>/memory/*.md

export type InjectedSource = {
  category: InjectedCategory;
  label: string; // display name, e.g. "rules/primary-workflow.md"
  path: string; // absolute path on disk
  scope: "global" | "project";
  chars: number;
  estTokens: number; // chars / 4 — same convention as hook estTokens
  content: string; // full file content
};

export type StartupContext = {
  slug: string;
  realPath: string;
  sources: InjectedSource[];
  totalChars: number;
  totalTokens: number;
  sharedTokens: number; // Σ global-* (identical for every project)
  projectTokens: number; // Σ project-* (this project only)
};

export type StartupContextSummary = {
  sharedTokens: number; // computed once: all global-* sources
  projects: {
    slug: string;
    realPath: string;
    totalTokens: number;
    projectTokens: number;
  }[];
};
