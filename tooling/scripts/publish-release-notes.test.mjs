import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENDPOINT,
  TRANSLATED_SINCE,
  publish,
  readEntries,
} from '../../.github/scripts/publish-release-notes.mjs';
import { PublishReleaseNotesSchema } from '../../packages/contracts/src/release-notes.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = {
  id: 'test-entry',
  title: '채팅 개선',
  items: ['최신 메시지를 보여요'],
  availability: 'web-app',
};
const env = {
  EXPECTED_SHA: 'a'.repeat(40),
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://actions.invalid/token?api-version=1',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token',
};
describe('배포 후 릴리즈 게시 스크립트', () => {
  it('수동 게시한 초안은 활성 목록에서 제외하고 보관된 문구도 서버 스키마와 일치한다', () => {
    const entries = readEntries(resolve(root, '.release-notes'));
    const archived = readEntries(resolve(root, '.release-notes/archive/2026-10-03-manual'));
    expect(archived).toHaveLength(7);
    expect(entries.some((entry) => archived.some((old) => old.id === entry.id))).toBe(false);
    expect(
      PublishReleaseNotesSchema.safeParse({ sha: env.EXPECTED_SHA, entries: archived }).success,
    ).toBe(true);
    expect(PublishReleaseNotesSchema.safeParse({ sha: env.EXPECTED_SHA, entries }).success).toBe(
      true,
    );
    for (const entry of [...entries, ...archived].filter(
      (e) => e.availability === 'web-app-pending',
    ))
      expect(entry.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('잘못된 파일과 중복 ID는 게시 전에 실패한다', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'release-notes-test-'));
    try {
      writeFileSync(
        resolve(dir, 'a.json'),
        JSON.stringify({ ...entry, availability: 'web-app-pending' }),
      );
      expect(() => readEntries(dir)).toThrow();
      writeFileSync(resolve(dir, 'a.json'), JSON.stringify(entry));
      writeFileSync(resolve(dir, 'b.json'), JSON.stringify(entry));
      expect(() => readEntries(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
  it('기준일 이후 파일은 영어·일본어 문구가 있어야 한다', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'release-notes-test-'));
    try {
      writeFileSync(resolve(dir, '2026-10-07-01-old.json'), JSON.stringify(entry));
      expect(readEntries(dir)).toHaveLength(1);
      const name = `${TRANSLATED_SINCE}-01-new.json`;
      const en = { title: 'Chat', items: ['Latest messages show up'] };
      writeFileSync(resolve(dir, name), JSON.stringify({ ...entry, id: 'new-entry', en }));
      expect(() => readEntries(dir)).toThrow('Japanese');
      const ja = { title: 'チャット', items: ['最新のメッセージが表示されます'] };
      writeFileSync(resolve(dir, name), JSON.stringify({ ...entry, id: 'new-entry', en, ja }));
      expect(readEntries(dir)).toHaveLength(2);
      writeFileSync(
        resolve(dir, name),
        JSON.stringify({ ...entry, id: 'new-entry', en, ja: { ...ja, extra: 1 } }),
      );
      expect(() => readEntries(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
  it('OIDC 대상·SHA·검토 문구를 정확히 전송한다', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'signed-token' })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { updated: true, postId: 'pst_test', publishedIds: [entry.id] } }),
        ),
      );
    const mask = vi.fn();
    expect(await publish([entry], env, fetch, mask)).toMatchObject({ updated: true });
    const [url, opts] = fetch.mock.calls[0];
    expect(url.searchParams.get('audience')).toBe(ENDPOINT);
    expect(opts.headers.Authorization).toBe('Bearer request-token');
    const [endpoint, request] = fetch.mock.calls[1];
    expect(endpoint).toBe(ENDPOINT);
    expect(request.headers.Authorization).toBe('Bearer signed-token');
    expect(JSON.parse(request.body)).toEqual({ sha: env.EXPECTED_SHA, entries: [entry] });
    expect(request.redirect).toBe('error');
    expect(mask).toHaveBeenCalledWith('::add-mask::signed-token');
  });
  it('인증 오류·게시 오류는 실패로 보고하며 원문·토큰을 출력하지 않는다', async () => {
    const noToken = vi.fn().mockResolvedValue(new Response('secret response', { status: 403 }));
    await expect(publish([entry], env, noToken, vi.fn())).rejects.toThrow(
      'GitHub OIDC request failed (403)',
    );
    expect(noToken).toHaveBeenCalledTimes(1);
    const conflict = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'signed-token' })))
      .mockResolvedValueOnce(new Response('private response', { status: 409 }));
    await expect(publish([entry], env, conflict, vi.fn())).rejects.toThrow(
      'publication failed (409)',
    );
  });
  it('새 항목이 없어도 운영 인증 경로를 확인하고 글과 알림은 갱신하지 않는다', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'signed-token' })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { postId: null, publishedIds: [], updated: false } })),
      );
    expect(await publish([], env, fetch, vi.fn())).toMatchObject({ updated: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).entries).toEqual([]);
  });
  it('모든 배포 잡 성공 뒤 deploy 모드에서만 게시하고 production OIDC 권한을 한 잡에 둔다', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/deploy-production.yml'), 'utf8');
    const job = workflow.slice(workflow.indexOf('\n  release-notes:'));
    expect(job).toContain('needs: [production-release, app-update, release-tag]');
    expect(job).toContain("if: inputs.mode == 'deploy'");
    expect(job).toContain('name: production');
    expect(job).toContain('id-token: write');
    expect(workflow.match(/id-token: write/g)).toHaveLength(1);
    expect(workflow).toContain('publish-release-notes.mjs validate .release-notes');
  });
});
