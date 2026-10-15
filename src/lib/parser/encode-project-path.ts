// Claude Code flat-encodes an absolute cwd into a project dir name by replacing
// every non-alphanumeric character with "-" (so "/", ".", "_", spaces all map to
// "-"). history.jsonl stores the raw cwd path, so to join a history row back to
// its session dir / project page we apply the same encoding. This is the forward
// direction of decode-project-path.ts; decoding is heuristic (because "-" is
// ambiguous) while encoding is deterministic. Verified against real dirs, e.g.
// "/Users/trung.hoang/.claude" -> "-Users-trung-hoang--claude" (the "/." -> "--").
export function encodeProjectSlug(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, "-");
}
