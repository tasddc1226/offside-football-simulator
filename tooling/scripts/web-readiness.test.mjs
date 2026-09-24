import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { candidatePaths, waitForWebCandidate } from './web-readiness.mjs';

const origin = 'https://offside-web-staging.tasddc1569.workers.dev';
const html = '<script type="module" src="/assets/index-new.js"></script><link rel="modulepreload" href="/assets/engine-new.js"><link rel="stylesheet" href="/assets/index-new.css">';
const assets = new Map(candidatePaths(html).map((path) => [path, `bytes:${path}`]));
const candidate = new Map([...assets].map(([path, bytes]) => [path, createHash('sha256').update(bytes).digest('hex')]));

function harness(shells = [html], mutate = (value) => value) {
  let clock = 0;
  let shellCount = 0;
  const fetchImpl = vi.fn(async (url, options) => {
    expect(options.redirect).toBe('error');
    expect(options.method).toBe('GET');
    expect(options.cache).toBe('no-store');
    const path = new URL(url).pathname;
    const body = path === '/onboarding' ? shells[Math.min(shellCount++, shells.length - 1)] : assets.get(path);
    return mutate({ status: 200, redirected: false, url, arrayBuffer: async () => new TextEncoder().encode(body) }, path);
  });
  return { origin, candidate, fetchImpl, timeoutMs: 50, intervalMs: 10,
    now: () => clock, sleep: async (ms) => { clock += ms; } };
}

describe('candidate web propagation guard', () => {
  it('extracts module entry, modulepreload and CSS only with safe local paths', () => {
    expect(candidatePaths(`${html}<link rel="icon" href="/favicon.svg">`)).toEqual([...candidate.keys()]);
    expect(
      candidatePaths(`${html}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">`),
    ).toEqual([...candidate.keys()]);
    expect(() => candidatePaths(html.replace('/assets/index-new.js', 'https://elsewhere.invalid/app.js'))).toThrow('INVALID_CANDIDATE_ASSET_PATH');
    expect(() => candidatePaths(html.replace('/assets/index-new.js', '/assets/../app.js'))).toThrow('INVALID_CANDIDATE_ASSET_PATH');
  });

  it('waits through old shell propagation and requires two consecutive exact candidates', async () => {
    const h = harness([html.replaceAll('-new', '-old'), html, html.replaceAll('-new', '-old'), html, html]);
    await expect(waitForWebCandidate(h)).resolves.toEqual({ attempts: 5, assets: 3, consecutive: 2 });
  });

  it('never accepts matching filenames containing different asset bytes', async () => {
    const h = harness([html], (response, path) => path.endsWith('.js') ? { ...response, arrayBuffer: async () => new TextEncoder().encode('wrong') } : response);
    await expect(waitForWebCandidate(h)).rejects.toThrow('ASSET_HASH_MISMATCH');
  });

  it('fails closed for redirect responses and nonapproved origins', async () => {
    await expect(waitForWebCandidate(harness([html], (response) => ({ ...response, redirected: true })))).rejects.toThrow('UNEXPECTED_WEB_RESPONSE');
    const h = harness();
    await expect(waitForWebCandidate({ ...h, origin: 'https://example.invalid' })).rejects.toThrow('UNAPPROVED_WEB_ORIGIN');
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  it('bounds a hanging fetch by both request and overall deadlines', async () => {
    vi.useFakeTimers();
    try {
      const task = waitForWebCandidate({ origin, candidate, fetchImpl: () => new Promise(() => {}), timeoutMs: 40, requestTimeoutMs: 10, intervalMs: 5 });
      const assertion = expect(task).rejects.toThrow('WEB_CANDIDATE_NOT_READY:REQUEST_TIMEOUT');
      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    } finally { vi.useRealTimers(); }
  });

  it('places the guard after web deployment and before production read-back and staging smoke checks', () => {
    const production = readFileSync(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
    const staging = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
    const guard = production.indexOf('node tooling/scripts/web-readiness.mjs');
    expect(guard).toBeGreaterThan(production.indexOf('name: Deploy production web'));
    expect(guard).toBeLessThan(production.indexOf('name: Read-back health, profile and web checks'));
    expect(production.slice(production.lastIndexOf('- name:', guard), guard)).toContain("if: inputs.mode == 'deploy'");
    expect(staging.indexOf('node tooling/scripts/web-readiness.mjs')).toBeGreaterThan(staging.indexOf('name: Migrate and deploy staging'));
    expect(staging.indexOf('node tooling/scripts/web-readiness.mjs')).toBeLessThan(staging.lastIndexOf('/guide/'));
    expect(production).not.toContain('web-readiness.mjs "$PRODUCTION_WEB_URL" apps/web/dist ||');
  });
});
