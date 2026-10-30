# Dead code and duplication audit

Run from the repository root with the repository Node/pnpm versions. These commands use pinned ephemeral tools and do not change workspace dependencies or the mobile runtime fingerprint inputs.

```sh
pnpm dlx knip@6.41.0 --config tooling/dead-code/knip.json
pnpm dlx knip@6.41.0 --config tooling/dead-code/knip.json --production
pnpm dlx jscpd@5.4.1 --mode weak --min-lines 8 --min-tokens 60 \
  --format typescript,tsx,javascript,svelte \
  --ignore '**/node_modules/**,**/dist/**,**/.expo/**,**/*.test.*,**/*.spec.*,**/i18n/**,**/vendor/**,**/fixtures/**' \
  --reporters json --output /tmp/offside-clones --silent apps packages tooling .github
```

Knip returns exit code 1 when it has findings. Inspect stderr and validate the JSON report before accepting a scan; exit code 2/configuration failures are not clean scans. Neither command is an automatic deletion list or a CI zero-findings gate. Do not use `--fix` without checking the callers.

The config explicitly includes Worker entry points, Expo Router files, web workers, tooling, app configuration and build scripts. The Expo plugin is disabled because Knip 6.41.0 cannot evaluate this repository's functional `app.config.js` plugin (`specifier.charCodeAt is not a function`); explicit entries replace plugin discovery. Keep those entries synchronized with the app's router/config changes. Production entry/project patterns carry `!`; production scans must not silently drop Router or Worker roots. Tests and test helpers are excluded from production projects.

Known interpretation requirements:

- Wrangler/Expo/default config exports are loaded by the framework, including notification screen reexports.
- `cloudflare:workers` is provided by the runtime, not an npm dependency called `cloudflare`.
- Expo autolinking, font package peers and named config plugins can use packages without source imports. Dependency removal also changes the native runtime; review separately.
- Contract barrel exports, inferred types, translations and immutable database migrations are not disposable solely because an importer was not found.
- Production-only results include helpers exercised only by tests/tooling. Test use is not production reachability, but it also is not proof that a compatibility rule should be deleted.
- jscpd detects similar token sequences, not interchangeable behavior. Svelte's embedded CSS/HTML can be counted separately; clone line counts overlap and are not unique removable lines. Web/native renderers, wire schemas and server simulation/client replay need distinct contracts.

See [the 2026-10-18 audit](../../docs/operations/dead-code-audit-2026-10-18.md) for the reviewed baseline, actual removals, retained findings and follow-up priorities. Detection/configuration semantics: [Knip configuration](https://knip.dev/reference/configuration), [production mode](https://knip.dev/features/production-mode), [jscpd](https://github.com/kucherenko/jscpd).
