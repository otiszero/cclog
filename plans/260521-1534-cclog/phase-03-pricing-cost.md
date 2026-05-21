# Phase 03 — Pricing Table + Cost Calculation

## Overview
- **Priority:** P1
- **Status:** pending
- Static pricing map + cost calculator. Display $ estimates with "as-of" disclaimer.

## Module: `src/lib/pricing.ts`
```ts
export const PRICING_AS_OF = "2026-05-21";

// $/MTok
export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheCreate5m: number; cacheCreate1h: number }> = {
  "claude-opus-4-7":     { input: 15, output: 75, cacheRead: 1.5, cacheCreate5m: 18.75, cacheCreate1h: 30 },
  "claude-opus-4-6":     { input: 15, output: 75, cacheRead: 1.5, cacheCreate5m: 18.75, cacheCreate1h: 30 },
  "claude-sonnet-4-6":   { input: 3,  output: 15, cacheRead: 0.3, cacheCreate5m: 3.75,  cacheCreate1h: 6 },
  "claude-haiku-4-5":    { input: 1,  output: 5,  cacheRead: 0.1, cacheCreate5m: 1.25,  cacheCreate1h: 2 },
};

export function estimateCost(model: string, usage: TokenUsage): number {
  const p = resolvePricing(model);
  if (!p) return 0;
  return (
    (usage.input * p.input +
     usage.output * p.output +
     usage.cacheRead * p.cacheRead +
     usage.cacheCreate * p.cacheCreate5m) / 1_000_000
  );
}

function resolvePricing(model: string) {
  // exact then prefix match (claude-opus-4-7-20260101 → claude-opus-4-7)
  return PRICING[model] ?? Object.entries(PRICING).find(([k]) => model.startsWith(k))?.[1];
}
```

## UI
- Global banner component `<PricingDisclaimer />` shown on any page that displays $ figures: "Pricing as of 2026-05-21. Verify on anthropic.com/pricing."
- Format: `$0.0123` if <$1 else `$12.34`.

## Files
- `src/lib/pricing.ts`
- `src/components/pricing-disclaimer.tsx`
- `src/lib/format-cost.ts` (helper)

## Success
- Cost for a known session within ±5% of manual calc.
- Unknown model → returns 0, doesn't crash.

## Risks
- Pricing drift — accept; show date prominently.
- Cache-create 5m vs 1h ambiguity — default to 5m (cheaper assumption noted in code comment).

## Todo
- [ ] pricing.ts with current table
- [ ] estimateCost + resolvePricing
- [ ] format-cost.ts
- [ ] disclaimer component
