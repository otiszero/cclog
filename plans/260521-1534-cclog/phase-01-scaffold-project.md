# Phase 01 — Scaffold Project + Tooling

## Overview
- **Priority:** P0 (foundation)
- **Status:** pending
- Bootstrap Next.js 15 project at `~/Desktop/cclog/` with TS, Tailwind, shadcn/ui, ESLint.

## Steps
1. `cd ~/Desktop && npx create-next-app@latest cclog --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack`
2. Install deps: `pnpm add recharts fuse.js zod date-fns clsx`
3. `pnpm dlx shadcn@latest init` (slate, CSS variables, dark mode default).
4. Add base shadcn components: `button card table tabs badge input scroll-area separator tooltip sheet skeleton`.
5. Configure `tsconfig.json` strict mode, `next.config.ts` `experimental.serverActions`.
6. Set up `src/lib/types.ts` skeleton: `SessionEvent`, `ParsedSession`, `TokenUsage`, `ProjectSummary`.
7. Create folder skeleton:
   ```
   src/
   ├── app/(routes...)
   ├── components/
   ├── lib/parser/
   ├── lib/pricing.ts
   └── lib/types.ts
   ```
8. Initial `README.md` with run instructions.

## Files Created
- `~/Desktop/cclog/` (project root)
- `src/lib/types.ts` (placeholders)
- `README.md`

## Success
- `pnpm dev` runs without errors, shows default page.
- shadcn `<Button>` renders.

## Risks
- Next.js 15 may need Node 20+.
- shadcn init prompts interactive — pass flags non-interactively when possible.

## Todo
- [ ] create-next-app
- [ ] install runtime deps
- [ ] shadcn init + components
- [ ] folder skeleton
- [ ] types.ts placeholders
- [ ] README.md
