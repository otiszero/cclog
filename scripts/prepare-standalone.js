#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

// Next.js `output: "standalone"` emits .next/standalone/server.js but does
// NOT copy public/ or .next/static — they must sit next to server.js at
// runtime. This script wires them up after `next build`.

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error("prepare-standalone: .next/standalone not found — run `next build` first");
  process.exit(1);
}

const copies = [
  { from: path.join(root, ".next", "static"), to: path.join(standalone, ".next", "static") },
  { from: path.join(root, "public"), to: path.join(standalone, "public") },
];

for (const { from, to } of copies) {
  if (!fs.existsSync(from)) continue;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`copied ${path.relative(root, from)} → ${path.relative(root, to)}`);
}
