import type { TokenUsage } from "@/lib/types";

// Pricing snapshot — verify against anthropic.com/pricing.
// Numbers in USD per million tokens (MTok).
export const PRICING_AS_OF = "2026-05-21";

type ModelPricing = {
  input: number;
  output: number;
  cacheRead: number;
  // We default to 5m ephemeral cache write rate (cheaper). 1h kept for reference.
  cacheCreate5m: number;
  cacheCreate1h: number;
};

export const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7":   { input: 15, output: 75, cacheRead: 1.5, cacheCreate5m: 18.75, cacheCreate1h: 30 },
  "claude-opus-4-6":   { input: 15, output: 75, cacheRead: 1.5, cacheCreate5m: 18.75, cacheCreate1h: 30 },
  "claude-opus-4":     { input: 15, output: 75, cacheRead: 1.5, cacheCreate5m: 18.75, cacheCreate1h: 30 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cacheRead: 0.3, cacheCreate5m: 3.75,  cacheCreate1h: 6 },
  "claude-sonnet-4-5": { input: 3,  output: 15, cacheRead: 0.3, cacheCreate5m: 3.75,  cacheCreate1h: 6 },
  "claude-sonnet-4":   { input: 3,  output: 15, cacheRead: 0.3, cacheCreate5m: 3.75,  cacheCreate1h: 6 },
  "claude-haiku-4-5":  { input: 1,  output: 5,  cacheRead: 0.1, cacheCreate5m: 1.25,  cacheCreate1h: 2 },
  "claude-haiku-4":    { input: 1,  output: 5,  cacheRead: 0.1, cacheCreate5m: 1.25,  cacheCreate1h: 2 },
};

export function resolvePricing(model: string): ModelPricing | undefined {
  if (!model) return undefined;
  const exact = PRICING[model];
  if (exact) return exact;
  // strip suffix like `[1m]` and date stamps
  const normalized = model.replace(/\[.*?\]/g, "").replace(/-\d{8}$/, "");
  if (PRICING[normalized]) return PRICING[normalized];
  // prefix match — pick longest matching key
  let bestKey = "";
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key) && key.length > bestKey.length) bestKey = key;
  }
  return bestKey ? PRICING[bestKey] : undefined;
}

export function estimateCost(model: string, usage: TokenUsage): number {
  const p = resolvePricing(model);
  if (!p) return 0;
  return (
    (usage.input * p.input +
      usage.output * p.output +
      usage.cacheRead * p.cacheRead +
      usage.cacheCreate * p.cacheCreate5m) /
    1_000_000
  );
}
