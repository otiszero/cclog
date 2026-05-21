export function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub ? (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}
