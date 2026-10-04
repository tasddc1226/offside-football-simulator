import { beforeAll, describe, expect, it } from 'vitest';
import { bytesToBase64Url } from './base64url.js';
import { RELEASE_AUDIENCE, verifyGithubRelease } from './github-release.js';

const sha = 'a'.repeat(40);
const now = 1791018000000;
const repo = 'tasddc1226/offside-football-simulator';
const claims = {
  iss: 'https://token.actions.githubusercontent.com',
  aud: RELEASE_AUDIENCE,
  sub: `repo:${repo}:environment:production`,
  repository: repo,
  repository_id: '1353771130',
  repository_owner_id: '55699007',
  ref: 'refs/heads/main',
  event_name: 'workflow_dispatch',
  workflow_ref: `${repo}/.github/workflows/deploy-production.yml@refs/heads/main`,
  workflow_sha: sha,
  sha,
  runner_environment: 'github-hosted',
  iat: now / 1000,
  nbf: now / 1000,
  exp: now / 1000 + 300,
};
describe('GitHub 운영 배포 OIDC', () => {
  let pair: CryptoKeyPair;
  let jwk: JsonWebKey & { kid: string };
  beforeAll(async () => {
    pair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    jwk = {
      ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey),
      kid: 'test',
    };
  });
  const token = async (extra: Record<string, unknown> = {}) => {
    const encode = (x: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(x)));
    const data = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({ ...claims, ...extra })}`;
    const signed = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      pair.privateKey,
      new TextEncoder().encode(data),
    );
    return `${data}.${bytesToBase64Url(new Uint8Array(signed))}`;
  };
  const verify = async (extra: Record<string, unknown> = {}) =>
    verifyGithubRelease(await token(extra), sha, {
      now,
      keys: async () => [jwk],
    });
  it('올바른 production/main 토큰과 immutable subject를 받는다', async () => {
    await expect(verify()).resolves.toBeUndefined();
    await expect(
      verify({
        sub: 'repo:tasddc1226@55699007/offside-football-simulator@1353771130:environment:production',
      }),
    ).resolves.toBeUndefined();
  });
  it.each([
    { iss: 'https://other.invalid' },
    { aud: 'other' },
    { repository_id: '1' },
    { repository_owner_id: '1' },
    { repository: 'other/repo' },
    { sub: `repo:${repo}:environment:staging` },
    { ref: 'refs/heads/feature' },
    { event_name: 'pull_request' },
    { workflow_ref: `${repo}/.github/workflows/ci.yml@refs/heads/main` },
    { sha: 'b'.repeat(40) },
    { workflow_sha: 'b'.repeat(40) },
    { runner_environment: 'self-hosted' },
    { exp: now / 1000 },
    { nbf: now / 1000 + 60 },
    { iat: now / 1000 - 601 },
  ])('서명이 맞아도 허용된 배포 조건이 아니면 거부한다 %j', async (extra) => {
    await expect(verify(extra)).rejects.toThrow();
  });
  it('payload 변조와 alg=none을 거부한다', async () => {
    const signed = await token();
    const parts = signed.split('.');
    parts[1] = bytesToBase64Url(
      new TextEncoder().encode(JSON.stringify({ ...claims, sha: 'b'.repeat(40) })),
    );
    await expect(
      verifyGithubRelease(parts.join('.'), sha, { now, keys: async () => [jwk] }),
    ).rejects.toThrow();
    await expect(
      verifyGithubRelease('eyJhbGciOiJub25lIn0.e30.', sha, { now, keys: async () => [jwk] }),
    ).rejects.toThrow();
  });
});
