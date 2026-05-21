# Code Standards

## Principles
YAGNI · KISS · DRY. Default to no comments unless WHY is non-obvious.

## File rules
- kebab-case for `.ts`/`.tsx`; descriptive (long is fine — self-documenting for grep)
- Keep files under ~200 LOC; split when crossing
- Server components by default; `"use client"` only when you need state/effects/charts

## TypeScript
- No `any`. Use discriminated unions (see `SessionEvent`)
- Types in `lib/types.ts` are the source of truth for the parser/UI contract
- Prefer narrow types over generic `Record<string, unknown>` at component boundaries

## Styling
- Tailwind v4 utility classes
- Theme tokens come from `app/globals.css` (`--card`, `--accent`, `--positive`, `--warning`, `--border`, `--muted`)
- Use CSS variables in `style={{...}}` over hardcoded hex when the value is themed
- Reuse `.card`, `.tag`, `.btn`, `.kpi-value`, `.kpi-label` instead of recreating

## Data + caching
- New per-session metrics → add to `derive-metrics.ts` so the existing LRU covers them
- Routes consume cached aggregators (`getParsedSession`, `aggregate-project`, `aggregate-global`), never `parse-session` directly

## Formatters
Always use `lib/format.ts` (`formatTokens`, `formatCost`, `formatDuration`, `formatRelative`). Don't ad-hoc `.toFixed()` in components.

## Lint / build
- `pnpm lint` — ESLint (flat config, extends `next`)
- `pnpm build` — type-check + production build; run after non-trivial changes
- Fix lint errors; warnings okay if pre-existing

## Commits
Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). No AI references. Never commit secrets.
