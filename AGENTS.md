# Working agreement

- Implementation is done directly by the Claude Code main session (2026-09-24; supersedes the "delegate to Sonnet 5" rule). Subagents are used only for independent, parallelizable work (copy writing, test backfill, unrelated features) and must implement directly without re-delegating.
- The main session reviews, verifies, merges and deploys its own changes.
- Preserve immutable old saves: any change to the save format must ship the matching migration code in `apps/web/src/game` so existing `localStorage` saves keep loading. Preserve unrelated user work.
