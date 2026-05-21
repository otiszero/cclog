# Deployment Guide

## Intended deployment: local-only

cclog is designed to run on the same machine that produced the Claude Code session logs. There is **no production deployment story** because:

- Logs live at `~/.claude/projects/*/*.jsonl` — only accessible from the local filesystem
- No auth layer — anyone with network access to the process can read all sessions
- No multi-user model

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Point at a non-default Claude config dir:

```bash
CLAUDE_HOME=/path/to/.claude pnpm dev
```

## Production-style local run

```bash
pnpm build
pnpm start
```

Same security model — bind to `127.0.0.1` only.

## If you must expose remotely (NOT recommended)

You'd need to add, at minimum:
1. Auth layer (none exists)
2. Reverse proxy with TLS
3. Bind override and firewall rules
4. Rate limiting on `/search` (Fuse.js index rebuild is 5min TTL but can be triggered by many users)

None of this is shipped. Treat the codebase as untrusted-network-unsafe.

## Updating pricing

When Anthropic changes model pricing, edit `src/lib/pricing.ts` table and update `PRICING_AS_OF`. No script — manual.
