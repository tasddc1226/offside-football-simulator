import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { createPost, updatePost } from '../db/repos/boards.js';
import { publishReleaseNotes } from '../db/repos/releaseNotes.js';
import { runNewsPush } from './dispatch.js';
import { unregisterPushDevice } from '../db/repos/pushDevices.js';
import { sha256Hex } from '../db/hash.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';

const now = Date.parse('2026-10-04T03:00:00.000Z');
const iso = (n = now) => new Date(n).toISOString();
const fields = { title: '오늘 공지', body: '본문', pinned: false };
let ctx: TestD1;
const production = () => ({ ...ctx.env, ENVIRONMENT: 'production', NEWS_PUSH_ENABLED: '1' });
const post = (board: 'notice' | 'release' = 'notice', time = now) =>
  createPost(ctx.db, board, fields, 'author', iso(time));
const deliveries = () =>
  ctx.env.DB.prepare('SELECT * FROM push_news_deliveries ORDER BY id').all<
    Record<string, unknown>
  >();
const events = () => ctx.env.DB.prepare('SELECT * FROM push_news_events ORDER BY id').all();
async function device(
  id = 'a',
  changes: {
    channel?: string;
    revoked?: string;
    expires?: number;
    deleted?: string;
    updated?: number;
  } = {},
) {
  const db = ctx.env.DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO profiles (id, settings_json, created_at, last_seen_at, deleted_at) VALUES (?, '{}', ?, ?, ?)`,
      )
      .bind(id, iso(), iso(), changes.deleted ?? null),
    db
      .prepare(
        `INSERT INTO sessions (id, profile_id, channel, token_hash, created_at, expires_at, revoked_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `s-${id}`,
        id,
        changes.channel ?? 'app',
        id,
        iso(),
        iso(changes.expires ?? now + 30 * 86400_000),
        changes.revoked ?? null,
        iso(),
      ),
    db
      .prepare(
        `INSERT INTO push_devices (installation_hash, session_id, profile_id, token, platform, app_version, updated_at)
      VALUES (?, ?, ?, ?, 'ios', '1.0.3', ?)`,
      )
      .bind(id, `s-${id}`, id, `ExpoPushToken[${id}]`, iso(changes.updated ?? now)),
  ]);
}
const accepted = () => Response.json({ data: [{ status: 'ok', id: 'ticket-a' }] });
beforeAll(async () => {
  ctx = await createTestD1();
});
afterAll(async () => {
  await ctx.dispose();
});
beforeEach(async () => {
  await ctx.env.DB.batch(
    ['push_news_events', 'push_devices', 'sessions', 'profiles', 'board_posts', 'app_meta'].map(
      (t) => ctx.env.DB.prepare(`DELETE FROM ${t}`),
    ),
  );
});

describe('공지 자동 푸시', () => {
  it('동의 철회와 계정 삭제는 발송 토큰 사본도 즉시 제거한다', async () => {
    await device();
    const hash = await sha256Hex('installation-a');
    await ctx.env.DB.prepare('UPDATE push_devices SET installation_hash = ?').bind(hash).run();
    await post();
    expect((await deliveries()).results).toHaveLength(1);
    await unregisterPushDevice(ctx.env.DB, 'installation-a');
    expect((await deliveries()).results).toHaveLength(0);
    await device('b');
    await post('release');
    const input = { sessionId: 's-b', sessionTokenHash: 'b', now: iso() };
    const { confirmToken } = await issueDeleteConfirmToken(input);
    await executeProfileDeletion(ctx.db, { ...input, profileId: 'b', confirmToken });
    expect((await deliveries()).results).toHaveLength(0);
  });
  it('동시 게시·수정은 한 번만 저장하고 게시판별·KST 자정 이후 첫 글은 각각 저장한다', async () => {
    await device();
    const ids = await Promise.all([post(), post()]);
    await updatePost(ctx.db, ids[0]!, { ...fields, title: '수정' }, iso(now + 1000));
    expect((await events()).results).toHaveLength(1);
    expect((await deliveries()).results).toHaveLength(1);
    await post('release');
    await post('notice', Date.parse('2026-10-04T15:00:00.000Z'));
    expect((await events()).results).toHaveLength(3);
    expect((await deliveries()).results).toHaveLength(3);
  });
  it('자동 릴리즈는 첫 생성만 큐에 넣고 dry-run·추가 항목·재배포는 중복하지 않는다', async () => {
    await device();
    const input = {
      sha: 'a'.repeat(40),
      dryRun: false,
      entries: [{ id: 'one', title: '개선', items: ['내용'], availability: 'web-app' as const }],
    };
    await publishReleaseNotes(ctx.env.DB, { ...input, dryRun: true }, iso());
    expect((await events()).results).toHaveLength(0);
    await publishReleaseNotes(ctx.env.DB, input, iso());
    await publishReleaseNotes(ctx.env.DB, input, iso());
    await publishReleaseNotes(
      ctx.env.DB,
      { ...input, entries: [{ ...input.entries[0]!, id: 'two' }] },
      iso(now + 1000),
    );
    expect((await events()).results).toHaveLength(1);
    expect((await deliveries()).results).toHaveLength(1);
  });
  it('배포 전 오늘 글이 있으면 추가 글에 알림을 만들지 않는다', async () => {
    await ctx.env.DB.prepare(
      `INSERT INTO board_posts (id, board, title, body, author_profile_id, created_at, updated_at)
      VALUES ('old', 'notice', '기존', '본문', 'author', ?, ?)`,
    )
      .bind(iso(now - 1000), iso(now - 1000))
      .run();
    await device();
    await post();
    expect((await events()).results).toHaveLength(0);
  });
  it('동의한 유효 앱 세션만 저장하고 새 기기를 나중에 추가하지 않는다', async () => {
    await device();
    await device('web', { channel: 'web' });
    await device('revoked', { revoked: iso() });
    await device('expired', { expires: now });
    await device('deleted', { deleted: iso() });
    await device('stale', { updated: now - 91 * 86400_000 });
    await post();
    await device('late');
    await post();
    expect((await deliveries()).results.map((r) => r.installation_hash)).toEqual(['a']);
  });
  it('동시 worker가 한 번만 접수하고 15분 뒤 receipt를 확인하며 글 이동 데이터를 보낸다', async () => {
    await device();
    const id = await post();
    const transport = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as unknown;
      expect(body).toMatchObject([
        { to: 'ExpoPushToken[a]', data: { type: 'offside-news', board: 'notice', postId: id } },
      ]);
      return accepted();
    });
    await Promise.all([
      runNewsPush(production(), now, transport),
      runNewsPush(production(), now, transport),
    ]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect((await deliveries()).results[0]).toMatchObject({ state: 'accepted', attempts: 1 });
    const receipt = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { 'ticket-a': { status: 'ok' } } }));
    await runNewsPush(production(), now + 15 * 60_000, receipt);
    expect(receipt.mock.calls[0]![0]).toContain('getReceipts');
    expect((await deliveries()).results[0]).toMatchObject({
      state: 'confirmed',
      token: '',
      receipt_attempts: 1,
    });
    await runNewsPush(production(), now + 16 * 60_000, receipt);
    expect(receipt).toHaveBeenCalledTimes(1);
  });
  it.each(['device', 'session', 'post', 'token', 'expiry'] as const)(
    '발송 전 %s 변경을 확인하고 취소한다',
    async (change) => {
      await device();
      const id = await post();
      if (change === 'device') await ctx.env.DB.prepare('DELETE FROM push_devices').run();
      if (change === 'session')
        await ctx.env.DB.prepare('UPDATE sessions SET revoked_at = ?').bind(iso()).run();
      if (change === 'post')
        await ctx.env.DB.prepare('UPDATE board_posts SET deleted_at = ? WHERE id = ?')
          .bind(iso(), id)
          .run();
      if (change === 'token')
        await ctx.env.DB.prepare("UPDATE push_devices SET token = 'ExpoPushToken[new]'").run();
      const transport = vi.fn<typeof fetch>();
      await runNewsPush(production(), change === 'expiry' ? now + 86400_000 : now, transport);
      expect(transport).not.toHaveBeenCalled();
      expect((await deliveries()).results[0]).toMatchObject({ state: 'cancelled', token: '' });
    },
  );
  it('429는 지연 재시도하고 최대 네 번 뒤 실패로 끝낸다', async () => {
    await device();
    await post();
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response('', { status: 429 }));
    await runNewsPush(production(), now, transport);
    await runNewsPush(production(), now + 60_000, transport);
    expect(transport).toHaveBeenCalledTimes(1);
    for (const minutes of [5, 15, 35])
      await runNewsPush(production(), now + minutes * 60_000, transport);
    expect(transport).toHaveBeenCalledTimes(4);
    expect((await deliveries()).results[0]).toMatchObject({ state: 'failed', attempts: 4 });
  });
  it('일시적 5xx 이후 재시도는 접수하고 타임아웃은 중복 재발송하지 않는다', async () => {
    await device();
    await post();
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(accepted());
    await runNewsPush(production(), now, transport);
    await runNewsPush(production(), now + 5 * 60_000, transport);
    expect((await deliveries()).results[0]).toMatchObject({ state: 'accepted', attempts: 2 });
    await post('release');
    const timeout = vi.fn<typeof fetch>().mockRejectedValue(new Error('private transport error'));
    await runNewsPush(production(), now, timeout);
    await runNewsPush(production(), now + 6 * 60_000, timeout);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(
      (await deliveries()).results.find((r) => r.event_id === 'release:2026-10-04'),
    ).toMatchObject({ state: 'unknown', token: '' });
  });
  it('중단된 발송 lease는 불명으로 끝내고 잘못된 receipt는 새 등록을 제거하지 않는다', async () => {
    await device();
    await post();
    await ctx.env.DB.prepare(
      "UPDATE push_news_deliveries SET state = 'sending', lease_id = 'old'",
    ).run();
    const transport = vi.fn<typeof fetch>();
    await runNewsPush(production(), now + 2 * 60_000, transport);
    expect(transport).not.toHaveBeenCalled();
    expect((await deliveries()).results[0]).toMatchObject({ state: 'unknown' });
    await post('release');
    await runNewsPush(production(), now, vi.fn<typeof fetch>().mockResolvedValue(accepted()));
    await ctx.env.DB.prepare("UPDATE push_devices SET token = 'ExpoPushToken[new]'").run();
    await runNewsPush(
      production(),
      now + 15 * 60_000,
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: { 'ticket-a': { status: 'error', details: { error: 'DeviceNotRegistered' } } },
        }),
      ),
    );
    expect(await ctx.env.DB.prepare('SELECT token FROM push_devices').first()).toEqual({
      token: 'ExpoPushToken[new]',
    });
  });
  it('등록되지 않은 토큰은 폐기하고 receipt가 없으면 조회만 다시 한다', async () => {
    await device();
    await post();
    await runNewsPush(production(), now, vi.fn<typeof fetch>().mockResolvedValue(accepted()));
    const empty = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ data: {} }));
    await runNewsPush(production(), now + 15 * 60_000, empty);
    expect((await deliveries()).results[0]).toMatchObject({ state: 'accepted', attempts: 1 });
    await runNewsPush(
      production(),
      now + 30 * 60_000,
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: { 'ticket-a': { status: 'error', details: { error: 'DeviceNotRegistered' } } },
        }),
      ),
    );
    expect((await deliveries()).results[0]).toMatchObject({ state: 'failed' });
    expect((await ctx.env.DB.prepare('SELECT * FROM push_devices').all()).results).toEqual([]);
  });
  it('큐 저장이 실패하면 공지와 자동 릴리즈 이력도 함께 롤백한다', async () => {
    await ctx.env.DB.prepare(
      "CREATE TRIGGER fail_push BEFORE INSERT ON push_news_events BEGIN SELECT RAISE(ABORT, 'test'); END",
    ).run();
    try {
      await expect(post()).rejects.toThrow();
      await expect(
        publishReleaseNotes(
          ctx.env.DB,
          {
            sha: 'a'.repeat(40),
            dryRun: false,
            entries: [{ id: 'rollback', title: '제목', items: ['내용'], availability: 'web-app' }],
          },
          iso(),
        ),
      ).rejects.toThrow();
      expect((await ctx.env.DB.prepare('SELECT * FROM board_posts').all()).results).toEqual([]);
      expect((await ctx.env.DB.prepare('SELECT * FROM app_meta').all()).results).toEqual([]);
    } finally {
      await ctx.env.DB.prepare('DROP TRIGGER fail_push').run();
    }
  });
  it('로컬·staging·운영 off에서는 외부 발송을 하지 않는다', async () => {
    await device();
    await post();
    const transport = vi.fn<typeof fetch>();
    for (const env of [
      ctx.env,
      { ...production(), ENVIRONMENT: 'staging' },
      { ...production(), NEWS_PUSH_ENABLED: '0' },
    ])
      expect(await runNewsPush(env, now, transport)).toEqual({ enabled: false });
    expect(transport).not.toHaveBeenCalled();
  });
});
