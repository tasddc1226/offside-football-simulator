# Automatic career moderation

Rule version 1 reuses the season-upload rules: `webdriver`, server-derived `headless`, at least five synthetic clicks exceeding trusted clicks, or two measured seasons with no click/key/touch input. Weak signals (cursor movement, timing, names, serial creation and continuous activity) remain observations only. These are operational signal criteria, not proof of a person's use of a bot.

Daily at 04:00 KST the job opens a fixed scan window. Its first window covers every retained signal, including preseason. Subsequent windows cover career update times since the last completed window, overlapping one hour. Each candidate uses all its retained signal history, not just the recent window.

Each invocation evaluates at most 5,000 candidates (ten 500-career pages). Unfinished or failed windows resume on existing five-minute cron ticks. Summaries use indexed candidate selection and 50-ID aggregate batches, never load whole season payloads into Worker memory. Cursors advance only after a page succeeds. A four-minute D1 lease prevents overlapping runs. Already hidden careers produce no duplicate action.

The hide audit, hidden flag, public firsts/records removal and conditional record-backfill reset share a D1 transaction. Original careers, seasons, cards and saved lineup IDs remain. Team selection/save/match construction already exclude hidden careers; old slots use youth fallback. Public caches expire within their existing TTL (lists/firsts one minute, HOF detail five minutes). Old match results and account access are unchanged.

`anomaly_cleared:<careerId>` is respected by both season-upload and scheduled automatic hiding. Operator restoration writes this exemption and a history event atomically. Automatic hiding rechecks the exemption inside its transaction. Manual hiding clears the exemption using the existing admin workflow. No historic moderation events are fabricated for previously hidden careers.

Operations → Automatic play shows enabled state, rule version, latest scan progress/failure and paginated action history, with reasons, timestamps, source, measured seasons and current hidden state. Restore uses the existing authenticated admin endpoint. Reads are cached for a minute; only opening, refresh, pagination and successful writes fetch data. No per-row requests or polling. Action history starts with this deployment.

Emergency pause: set `AUTOMATION_HIDE_DISABLED=1` for the API Worker to stop upload and scheduled automatic hiding. Manual restore still works. Remove the setting to resume.

Deployment applies a partial signal index and a career update index. No game save-format or engine changes. Code review and deployment are separate steps; implementation does not alter production records.
