# Working agreement

- Implementation is done directly by the Claude Code main session (2026-09-24; supersedes the "delegate to Sonnet 5" rule). Subagents are used only for independent, parallelizable work (copy writing, test backfill, unrelated features) and must implement directly without re-delegating.
- The main session reviews, verifies, merges and deploys its own changes.
- Protect the backend (2026-09-25): request data only when it is actually needed. Load on open, never refetch the same data on every screen entry, and avoid N+1 and polling. Web GETs go through `cachedGet`. Public reads never look up the session (`resolveSession` only where required). Shared public GETs use `edgeCached` with a `purgeEdge` on every write that changes them. New sort/filter queries ship with an index. See "백엔드 보호 · 요청 최소화 규칙" in `CLAUDE.md`.
- Preserve immutable old saves: any change to the save format must ship the matching migration code in `apps/web/src/game` so existing `localStorage` saves keep loading. Preserve unrelated user work.
