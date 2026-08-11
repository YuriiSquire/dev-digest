#!/usr/bin/env node
// Stop hook for the engineering-insights loop.
//
// Forces the record pass ONCE at the end of a session that edited files, by
// blocking the first stop and feeding the agent an instruction to run the
// skill's record step. The skill's own gate then decides whether anything is
// actually worth writing (a trivial session records nothing).
//
// Guards:
//   - stop_hook_active: true  -> we are already in a hook-triggered
//     continuation, so allow the stop (prevents an infinite loop).
//   - no file-editing tool used in the session -> trivial, allow the stop.
//   - any failure reading the transcript -> fail open (never block on error).
//
// Edit-detection blind spots (heuristic, not exhaustive): we scan the main
// transcript for the structured write tools in WRITE_TOOLS. Two edit paths are
// NOT detected, so a session whose ONLY writes go through them will not be
// forced to record:
//   - Bash edits (sed, >, cat <<EOF, patch) -> no structured tool_use block.
//   - Subagent (Task/Agent) edits -> those tool_use blocks live in the
//     subagent's own transcript, not this input.transcript_path.
// This is intentional (CLAUDE.md steers edits through Edit/Write anyway); the
// cost of a miss is a skipped record pass, never a wedged session.

import { readFileSync } from 'node:fs';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch {
  process.exit(0);
}

// Already continuing because of a previous Stop-hook block -> let it stop.
if (input.stop_hook_active) process.exit(0);

const transcriptPath = input.transcript_path;
if (!transcriptPath) process.exit(0);

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
let edited = false;
try {
  const lines = readFileSync(transcriptPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const content = obj && obj.message && obj.message.content;
    if (!Array.isArray(content)) continue;
    if (content.some((b) => b && b.type === 'tool_use' && WRITE_TOOLS.has(b.name))) {
      edited = true;
      break;
    }
  }
} catch {
  process.exit(0); // cannot read transcript -> do not block
}

if (!edited) process.exit(0);

const reason =
  'Before ending: this session edited files, so run the engineering-insights ' +
  'RECORD pass now. Resolve the touched module from the skill\'s ' +
  'module-resolution table, read that INSIGHTS.md, then apply the gate — if ' +
  'nothing non-obvious surfaced, write nothing and say "nothing worth ' +
  'recording"; otherwise dedup (grep) and append at most 3 entries under the ' +
  'right sections, newest first. Add them with a targeted Edit that leaves all ' +
  'existing content intact — never overwrite the file or use the Write tool on ' +
  'it. Report one line per action. Do not redo the coding work; only record ' +
  'insights.';

process.stdout.write(JSON.stringify({ decision: 'block', reason }));
process.exit(0);
