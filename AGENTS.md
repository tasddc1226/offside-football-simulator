# Working agreement

- Implementation is delegated to Claude Sonnet 5 subagents (isolated worktrees). This supersedes the earlier "delegate to Luna" rule (2026-09-24, ADR-013).
- The coordinator (Claude Code main session) instructs, reviews, and verifies changes; review fixes are routed back to a Sonnet 5 subagent.
- Preserve immutable old saves: a subagent changing the save format must ship the matching migration code in `apps/web/src/game` so existing `localStorage` saves keep loading. Preserve unrelated user work.
