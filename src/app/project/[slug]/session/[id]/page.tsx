import Link from "next/link";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { projectsDir } from "@/lib/parser/claude-home";
import { getParsedSession } from "@/lib/parser/cache";
import { decodeProjectSlug } from "@/lib/parser/decode-project-path";
import {
  estimateSessionCost,
  leaderboardByCategory,
  modelsUsed,
  sumTokens,
  totalTokens,
} from "@/lib/parser/derive-metrics";
import { KpiCard } from "@/components/common/kpi-card";
import { SessionTabs } from "@/components/session/session-tabs";
import { formatCost, formatDuration, formatRelative, formatTokens } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const filePath = join(projectsDir(), decodedSlug, `${id}.jsonl`);
  let parsed;
  try {
    parsed = await getParsedSession(filePath, decodedSlug);
  } catch {
    notFound();
  }
  if (!parsed) notFound();

  const tokens = totalTokens(parsed.events);
  const cost = estimateSessionCost(parsed.events);
  const models = modelsUsed(parsed.events);
  const durationMs =
    parsed.startedAt && parsed.endedAt
      ? Math.max(0, Date.parse(parsed.endedAt) - Date.parse(parsed.startedAt))
      : 0;
  const turnCount = parsed.events.filter((e) => e.kind === "turn").length;

  const byTool = leaderboardByCategory(parsed, "tool");
  const byMcp = leaderboardByCategory(parsed, "mcp");
  const bySkill = leaderboardByCategory(parsed, "skill");
  const bySubAgent = leaderboardByCategory(parsed, "sub_agent");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href={`/project/${encodeURIComponent(decodedSlug)}`}
          className="text-xs"
          style={{ color: "var(--muted)" }}
        >
          ← {decodeProjectSlug(decodedSlug)}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 font-mono">{id}</h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {turnCount} turns · {models.join(", ")} · started{" "}
          {formatRelative(parsed.startedAt)}
          {parsed.skippedLines > 0
            ? ` · ${parsed.skippedLines} malformed lines skipped`
            : ""}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total tokens" value={formatTokens(sumTokens(tokens))} />
        <KpiCard label="Input" value={formatTokens(tokens.input)} />
        <KpiCard label="Output" value={formatTokens(tokens.output)} />
        <KpiCard label="Cache (read+write)" value={formatTokens(tokens.cacheRead + tokens.cacheCreate)} />
        <KpiCard label="Est. cost" value={formatCost(cost)} sub={formatDuration(durationMs)} />
      </section>

      <SessionTabs
        parsed={parsed}
        byTool={byTool}
        byMcp={byMcp}
        bySkill={bySkill}
        bySubAgent={bySubAgent}
      />
    </div>
  );
}
