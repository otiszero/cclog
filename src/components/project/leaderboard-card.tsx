import type { LeaderboardRow } from "@/lib/types";
import { formatCost, formatTokens } from "@/lib/format";
import { sumTokens } from "@/lib/parser/derive-metrics";

export function LeaderboardCard({
  title,
  rows,
  emptyHint,
  maxRows = 8,
}: {
  title: string;
  rows: LeaderboardRow[];
  emptyHint?: string;
  maxRows?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {emptyHint ?? "No data."}
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col" className="text-right num">
                Calls
              </th>
              <th scope="col" className="text-right num">
                Tokens
              </th>
              <th scope="col" className="text-right num">
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, maxRows).map((r) => (
              <tr key={r.key}>
                <td className="truncate max-w-[260px]" title={r.key}>
                  {r.key}
                </td>
                <td className="text-right num">{r.count}</td>
                <td className="text-right num">
                  {formatTokens(sumTokens(r.tokens))}
                </td>
                <td className="text-right num">{formatCost(r.estCostUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
