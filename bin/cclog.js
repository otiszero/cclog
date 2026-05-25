#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

const PKG = require("../package.json");

function printHelp() {
  process.stdout.write(`cclog ${PKG.version} — local dashboard for Claude Code session logs

Usage:
  cclog [options]

Options:
  -p, --port <n>          Port to listen on (default: 3000, auto-bumps if in use)
  -H, --host <addr>       Host to bind (default: 127.0.0.1)
      --claude-home <dir> Path to your .claude directory (default: ~/.claude)
      --no-open           Do not open browser automatically
  -h, --help              Show this help
  -v, --version           Show version
`);
}

function parseArgs(argv) {
  const opts = { port: 3000, host: "127.0.0.1", open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "-v" || a === "--version") opts.version = true;
    else if (a === "-p" || a === "--port") opts.port = Number(argv[++i]);
    else if (a === "-H" || a === "--host") opts.host = argv[++i];
    else if (a === "--claude-home") opts.claudeHome = argv[++i];
    else if (a === "--no-open") opts.open = false;
    else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

function findFreePort(start, host) {
  return new Promise((resolve, reject) => {
    const tryPort = (port, attempts) => {
      if (attempts > 50) return reject(new Error("No free port found"));
      const srv = net.createServer();
      srv.once("error", (err) => {
        if (err.code === "EADDRINUSE") tryPort(port + 1, attempts + 1);
        else reject(err);
      });
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port, host);
    };
    tryPort(start, 0);
  });
}

function openBrowser(url) {
  const cmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "cmd" :
    "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // best-effort
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return printHelp();
  if (opts.version) return process.stdout.write(`${PKG.version}\n`);

  const root = path.resolve(__dirname, "..");
  const standaloneServer = path.join(root, ".next", "standalone", "server.js");
  if (!fs.existsSync(standaloneServer)) {
    process.stderr.write(
      "cclog: build artifacts not found. If installed from npm please reinstall.\n" +
      `Missing: ${standaloneServer}\n`,
    );
    process.exit(1);
  }

  const port = await findFreePort(opts.port, opts.host);
  const env = { ...process.env, PORT: String(port), HOSTNAME: opts.host };
  if (opts.claudeHome) env.CLAUDE_HOME = path.resolve(opts.claudeHome);

  const child = spawn(process.execPath, [standaloneServer], {
    cwd: path.dirname(standaloneServer),
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });

  const url = `http://${opts.host}:${port}`;
  let opened = false;
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    if (!opened && /ready|started server|listening/i.test(chunk.toString())) {
      opened = true;
      process.stdout.write(`\ncclog ready → ${url}\n`);
      if (opts.open) openBrowser(url);
    }
  });

  const shutdown = (sig) => {
    child.kill(sig);
    setTimeout(() => process.exit(0), 200).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  process.stderr.write(`cclog: ${err.message}\n`);
  process.exit(1);
});
