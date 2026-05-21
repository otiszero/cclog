import { PRICING_AS_OF } from "@/lib/pricing";

export function PricingDisclaimer() {
  return (
    <p className="text-xs" style={{ color: "var(--muted)" }}>
      Cost estimates use a static pricing table as of {PRICING_AS_OF}. Numbers may diverge from
      actual Anthropic billing — verify on{" "}
      <a href="https://www.anthropic.com/pricing" target="_blank" rel="noreferrer">
        anthropic.com/pricing
      </a>
      . All data is read locally from <code>~/.claude/projects</code>; nothing leaves your machine.
    </p>
  );
}
