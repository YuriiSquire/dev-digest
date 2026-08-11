#!/usr/bin/env sh
# SessionStart hook for the engineering-insights loop.
# Injects a reminder to read the touched module's INSIGHTS.md before doing work.
# Output goes into the model's context via hookSpecificOutput.additionalContext.
printf '%s' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"[engineering-insights] Before doing work this session: resolve the module the request touches (server/, client/, reviewer-core/, e2e/, or the root INSIGHTS.md for cross-package or workflow changes), read that INSIGHTS.md in full, and state in one line what you will use from it. At the end of a task that edits files, the Stop hook will prompt you to record new insights back into that same file."}}'
