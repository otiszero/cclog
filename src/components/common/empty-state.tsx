export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-8 px-4 gap-2"
      role="status"
    >
      {icon ? (
        <div
          aria-hidden="true"
          style={{ color: "var(--foreground-subtle)" }}
        >
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {hint ? (
        <p
          className="text-xs max-w-md"
          style={{ color: "var(--foreground-muted)" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
