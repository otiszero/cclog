# Token Efficiency Metrics for Coding Agents: Research Summary

## What the Community Actually Measures

**Cache Hit Rate** (primary metric, >90% considered healthy): Ratio of cache_read_input_tokens to total input_tokens. Anthropic docs frame this as critical; production deployments track obsessively. Branch8's 6-month study showed cache optimization alone achieved 72% cost reduction. **Bad**: <20% hit rate signals either short cache TTL, missing cache boundaries, or static content not being cacheable. **Why cared about**: Cached reads cost 10% of normal input price; 5-10x cost multiplier on input.

**Tokens-Per-Task Ratio**: Total tokens (input + output) divided by task count or feature scope. Simple tasks: 5K-15K tokens; complex multi-agent: 200K-1M tokens. **Bad**: >50K tokens for a single file edit or <0.8 output/input ratio. **Why**: Indicates re-reading loops, bloated context, or failed attempts. AgentDiet papers document 55-87% input reduction possible via compression.

**Context Utilization %**: (Total tokens used / max window per turn) × 100. Practical threshold: intervene at 60%, critical at 80-90%. **Bad**: >75% sustained, or sessions hitting ceiling regularly. **Why**: Context rot accelerates quality degradation; hitting ceiling forces expensive compaction or session reset.

**Re-Read Waste %**: (File bytes read multiple times / total file bytes read) × 100. Computable from tool_use logs: grep same file paths across turns, sum bytes. **Bad**: >30% re-read rate. **Why**: DEV Community complaint: agents waste 80% on files already read. Cost multiplier: same file read 3x costs 3x tokens.

**Tool Output Bloat Ratio**: (Sum of tool output_tokens / total output_tokens) × 100. When exceeds ~60%, signals unfiltered command output (full test logs, massive diffs). **Bad**: >70%; indicates "head -n 50" truncation anti-pattern. **Why**: Tool output accumulates in context for ALL subsequent turns; one bloated command output costs all future turns.

**Cache Hit Frequency** (new metric): Turns with >0 cache_read_input_tokens / total turns. **Bad**: <50% of turns hit cache. **Why**: Indicates cache misses due to session fragmentation, TTL expirations (post-March 2026 5min default), or context resets.

---

## Anti-Patterns Detectable from JSONL Alone

### 1. **Re-Grep Loop** 
**Detector**: Identical `tool_use.input.path` appearing 3+ times across consecutive turns.
```
Turn 5: tool_use: Read src/auth.ts (1240 tokens)
Turn 7: tool_use: Read src/auth.ts (1240 tokens)
Turn 10: tool_use: Read src/auth.ts (1240 tokens)
Signal: 3720 wasted tokens on same file.
```
**Fix**: Subcache the file once, reference by line number. Cost: 0 re-read tokens.

### 2. **Cache Collapse on TTL Boundary**
**Detector**: input_tokens spike 5x after 5min gap, cache_read drops to 0.
```
Turn 1-15: cache_read_input_tokens = 2000+ per turn
Turn 16: [5+ min gap] cache_read_input_tokens = 0, input_tokens spike to 8000+
Turn 17+: gradual cache recovery
Signal: Cache expired; TTL too aggressive or tab closed.
```
**Fix**: Use 1-hour TTL for repetitive sessions, or restructure to keep prefix active.

### 3. **Tool Output Explosion** 
**Detector**: Single turn with output_tokens > 5000 (above median by 3σ), followed by 5+ turns with elevated input_tokens.
```
Turn 8: output_tokens = 8500 (full pytest output, unfiltered)
Turn 9-14: input_tokens = 4000+ each (context bloat from single output)
Signal: Tool output contaminated context for 6 turns; ~24K wasted tokens.
```
**Fix**: Capture exit code, swallow output unless non-zero. Cost: 100 tokens instead of 8500.

---

## Candidate Metrics Summary

| Metric | Formula | Bad Threshold | Community Priority |
|--------|---------|----------------|-------------------|
| Cache Hit Rate | cache_read / (cache_read + input) | <20% | ⭐⭐⭐ Critical |
| Tokens-Per-Task | (input + output) / task_count | >50K | ⭐⭐⭐ Critical |
| Context Util % | tokens_used / context_max | >75% sustained | ⭐⭐ High |
| Re-Read Waste % | repeated_file_bytes / total_bytes | >30% | ⭐⭐ High |
| Tool Output Bloat % | tool_output_tokens / total_output | >70% | ⭐⭐ High |
| Cache Hit Frequency | turns_with_cache_hit / total_turns | <50% | ⭐⭐ High |
| Session Compaction Rate | compactions / session_length | >1 per 50 turns | ⭐ Medium |
| File Read Diversity | unique_files_read / total_reads | <0.3 | ⭐ Medium |

---

## Existing Tools & Coverage

**ccusage** (GitHub: ryoppippi/ccusage): Reads local JSONL, produces daily/weekly/monthly cost reports. Covers input/output tokens, cache metrics. No tool-specific efficiency drilling.

**claude-context-optimizer** (Egor Fedorov): Heatmaps, ROI reports, budget alerts. Claims 30-50% token savings via context visualization. Does NOT expose anti-pattern detectors.

**Anthropic Docs** (docs.claude.com): Official cache hit rate framing, no published benchmarks. Mentions >90% as "healthy" but no data.

**Branch8 Case Study**: 6-month study logged 240M tokens month-1 → 680M total spending month-3 after caching/budgeting. Implies ~30% avg cache hit rate pre-optimization.

---

## Gaps cclog Can Fill

1. **Anti-pattern detection** (re-read loops, cache collapse, tool bloat) — none of existing tools expose this
2. **Per-tool efficiency** — no community tool breaks down cache hit rate by tool type (bash vs file read vs MCP)
3. **Cost-per-insight** — no metric for tokens spent per meaningful output (semantic understanding required, but JSONL cannot detect)
4. **Session quality drift** — no tool tracks output quality degradation as context grows (would require human labeled sessions)

---

## Sources

- [Claude Code Token Limits Guide](https://www.faros.ai/blog/claude-code-token-limits)
- [Prompt Caching in LLMs](https://blog.dailydoseofds.com/p/prompt-caching-in-llms)
- [Prompt Caching - Claude Docs](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)
- [How Prompt Caching Works in Claude Code](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code)
- [ProjectDiscovery: Cut Costs by 59% with Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [Context Rot in AI Coding Agents](https://www.mindstudio.ai/blog/context-rot-ai-coding-agents-explained)
- [Context Engineering Guide](https://labs.adaline.ai/p/context-rot-why-llms-are-getting)
- [ccusage - Token Usage Analysis Tool](https://ccusage.com/guide/)
- [Why AI Coding Agents Burn Tokens: The Context Re-Reading Loop](https://docs.bswen.com/blog/2026-03-10-ai-coding-context-window-problem/)
- [Context Problem: Why Agents Waste 80% on Re-Reads](https://dev.to/creatman/the-context-problem-nobody-talks-about-why-ai-coding-agents-waste-80-of-tokens-on-files-they-mp1)
- [CodeAgents: Token-Efficient Framework](https://arxiv.org/pdf/2507.03254)
- [Reducing LLM Agent Costs via Trajectory Reduction](https://arxiv.org/pdf/2509.23586)
- [AI Token Usage Guide 2026](https://iternal.ai/token-usage-guide)
- [LLM Token Optimization 2026](https://redis.io/blog/llm-token-optimization-speed-up-apps/)
- [Claude Code Context Mode Compression](https://www.mindstudio.ai/blog/claude-code-context-mode-compresses-315kb-sessions-5kb-how-to-install)
- [Using Claude Code: Session Management and 1M Context](https://claude.com/blog/using-claude-code-session-management-and-1m-context)
- [Context Optimizer: 63% Token Reduction](https://github.com/egorfedorov/claude-context-optimizer)
- [AGENTS.md Evaluation Research](https://arxiv.org/pdf/2602.11988)
- [Impact of AGENTS.md on Agent Efficiency](https://arxiv.org/pdf/2601.20404)

## Unresolved Questions

1. What's the optimal cache TTL for different session types (spike vs sustained sessions)?
2. Should metrics weight output_tokens less than input_tokens (output is harder to compress)?
3. How to measure quality degradation without labeled ground truth across sessions?
4. Does cache hit rate have diminishing returns past 85%, or is 95%+ worth optimizing for?
