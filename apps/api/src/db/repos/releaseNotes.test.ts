import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PublishReleaseNotes, ReleaseNote } from '@offside/contracts';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { appendReleaseNotes, publishReleaseNotes, releaseDay } from './releaseNotes.js';

const now = '2026-10-03T09:00:00.000Z';
const entry: ReleaseNote = {
  id: 'test-records',
  title: '기록실 개선',
  items: ['선수 국적을 모두 표시해요'],
  availability: 'web-app',
};
const input = (entries = [entry]): PublishReleaseNotes => ({
  sha: 'a'.repeat(40),
  entries,
  dryRun: false,
});

describe('릴리즈 노트 게시 트랜잭션', () => {
  let ctx: TestD1;
  beforeAll(async () => {
    ctx = await createTestD1();
  });
  afterAll(async () => {
    await ctx.dispose();
  });
  beforeEach(async () => {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare('DELETE FROM board_posts'),
      ctx.env.DB.prepare('DELETE FROM app_meta'),
    ]);
  });
  const daily = async (body = '직접 쓴 내용\n\n## 7. 응원하기\n- 기존 안내\n\n감사합니다\n') => {
    await ctx.env.DB.prepare(
      `INSERT INTO board_posts
      (id, board, title, body, author_profile_id, pinned, version, view_count, like_count, created_at, updated_at)
      VALUES ('manual', 'release', '261003 릴리즈노트', ?, 'author', 1, 'v1', 100, 7, ?, ?)`,
    )
      .bind(body, '2026-10-02T15:44:06.000Z', now)
      .run();
  };
  const post = () =>
    ctx.env.DB.prepare('SELECT * FROM board_posts LIMIT 1').first<Record<string, unknown>>();
  const ledger = () =>
    ctx.env.DB.prepare("SELECT * FROM app_meta WHERE key LIKE 'release-note:%'").all();

  it('한국 시간 자정으로 하루를 나눈다', () => {
    expect(releaseDay('2026-10-02T14:59:59.999Z').day).toBe('2026-10-02');
    expect(releaseDay('2026-10-02T15:00:00.000Z')).toMatchObject({
      day: '2026-10-03',
      title: '261003 릴리즈노트',
      start: '2026-10-02T15:00:00.000Z',
    });
  });
  it('오늘 글의 본문·작성자·고정·버전·조회수·좋아요를 보존하고 감사 인사 앞에 이어 쓴다', async () => {
    await daily();
    const r = await publishReleaseNotes(ctx.env.DB, input(), now);
    expect(r).toEqual({ postId: 'manual', updated: true, publishedIds: ['test-records'] });
    expect(await post()).toMatchObject({
      body: '직접 쓴 내용\n\n## 7. 응원하기\n- 기존 안내\n\n## 8. 기록실 개선\n- 선수 국적을 모두 표시해요\n감사합니다\n',
      pinned: 1,
      author_profile_id: 'author',
      version: 'v1',
      view_count: 100,
      like_count: 7,
      updated_at: '2026-10-03T09:00:00.001Z',
    });
    expect((await ledger()).results).toHaveLength(1);
  });
  it('첫 게시·재실행·다른 SHA 재배포·다음 날에도 같은 항목을 반복하지 않는다', async () => {
    await publishReleaseNotes(ctx.env.DB, input(), now);
    const first = await post();
    expect(first).toMatchObject({
      id: 'pst_release_20261003',
      author_profile_id: 'release-automation',
    });
    for (const time of [now, '2026-10-04T09:00:00.000Z']) {
      expect(
        await publishReleaseNotes(ctx.env.DB, { ...input(), sha: 'b'.repeat(40) }, time),
      ).toEqual({ postId: null, updated: false, publishedIds: [] });
    }
    expect(await post()).toEqual(first);
  });
  it('실패 후 다음 배포에서 미게시 항목과 새 항목을 함께 반영한다', async () => {
    await publishReleaseNotes(ctx.env.DB, input(), now);
    const next = { ...entry, id: 'test-chat', title: '채팅 개선' };
    const r = await publishReleaseNotes(ctx.env.DB, input([entry, next]), now);
    expect(r.publishedIds).toEqual(['test-chat']);
    expect((await ledger()).results).toHaveLength(2);
    expect((await post())!.body).toContain('## 2. 채팅 개선');
  });
  it('게시한 ID의 문구를 바꾸면 조용히 건너뛰지 않고 정정을 요구한다', async () => {
    await publishReleaseNotes(ctx.env.DB, input(), now);
    const first = await post();
    await expect(
      publishReleaseNotes(ctx.env.DB, input([{ ...entry, title: '바뀐 제목' }]), now),
    ).rejects.toMatchObject({ status: 409 });
    expect(await post()).toEqual(first);
  });
  it('dry-run과 빈 항목은 본문·수정 시각·게시 이력을 바꾸지 않는다', async () => {
    await daily();
    const first = await post();
    const r = await publishReleaseNotes(ctx.env.DB, { ...input(), dryRun: true }, now);
    expect(r.updated).toBe(false);
    expect(r.preview).toContain('## 8. 기록실 개선');
    expect(await publishReleaseNotes(ctx.env.DB, input([]), now)).toMatchObject({ updated: false });
    expect(await post()).toEqual(first);
    expect((await ledger()).results).toEqual([]);
  });
  it('앱 업데이트 예정과 웹 전용 항목을 구분한다', () => {
    expect(
      appendReleaseNotes('본문', [
        { ...entry, availability: 'web-app-pending', appVersion: '1.0.2' },
      ]),
    ).toContain('웹에 먼저 적용했어요. 앱은 1.0.2 업데이트로 제공할 예정이에요');
    expect(appendReleaseNotes('본문', [{ ...entry, availability: 'app' }])).toContain(
      '앱에 적용했어요',
    );
    expect(appendReleaseNotes('본문', [{ ...entry, availability: 'web' }])).toContain(
      '웹에 적용했어요',
    );
  });
  it('영어·일본어 본문을 함께 쌓고 번역이 없는 항목·옛 오늘 글은 한국어로 이어 쓴다', async () => {
    const en = { title: 'Records', items: ['Shows every nationality'] };
    await publishReleaseNotes(ctx.env.DB, input([{ ...entry, en }]), now);
    expect(JSON.parse(String((await post())!.i18n_json))).toEqual({
      en: {
        title: '261003 Release notes',
        body: '261003 Release notes\n\n## 1. Records\n- Shows every nationality',
      },
      ja: {
        title: '261003 リリースノート',
        body: '261003 リリースノート\n\n## 1. 기록실 개선\n- 선수 국적을 모두 표시해요',
      },
    });
    // 번역 칸을 나중에 더해도 게시한 항목의 이력 해시(한국어 원문)는 그대로다.
    const ja = { title: '記録室の改善', items: ['すべての国籍を表示します'] };
    const next = { ...entry, id: 'test-web', availability: 'web' as const, en, ja };
    expect(
      (await publishReleaseNotes(ctx.env.DB, input([{ ...entry, en, ja }, next]), now))
        .publishedIds,
    ).toEqual(['test-web']);
    const i18n = JSON.parse(String((await post())!.i18n_json));
    expect(i18n.en.body).toContain(
      '## 2. Records\n- Shows every nationality\n- Available on the web',
    );
    expect(i18n.ja.body).toContain(
      '## 2. 記録室の改善\n- すべての国籍を表示します\n- Web版に適用しました',
    );

    await ctx.env.DB.prepare('DELETE FROM board_posts').run();
    await ctx.env.DB.prepare('DELETE FROM app_meta').run();
    await daily();
    await publishReleaseNotes(ctx.env.DB, input([{ ...entry, en, ja }]), now);
    expect(JSON.parse(String((await post())!.i18n_json)).en).toEqual({
      title: '261003 Release notes',
      body: '직접 쓴 내용\n\n## 7. 응원하기\n- 기존 안내\n\n## 8. Records\n- Shows every nationality\n감사합니다\n',
    });
  });
  it('삭제된 글과 본문 한도 초과는 이력을 남기지 않는다', async () => {
    await daily();
    await ctx.env.DB.prepare("UPDATE board_posts SET deleted_at = ? WHERE id = 'manual'")
      .bind(now)
      .run();
    await expect(publishReleaseNotes(ctx.env.DB, input(), now)).rejects.toMatchObject({
      status: 409,
    });
    await ctx.env.DB.prepare(
      "UPDATE board_posts SET deleted_at = NULL, body = ? WHERE id = 'manual'",
    )
      .bind('x'.repeat(5000))
      .run();
    await expect(publishReleaseNotes(ctx.env.DB, input(), now)).rejects.toMatchObject({
      status: 409,
    });
    expect((await ledger()).results).toEqual([]);
  });
  it('본문을 읽은 뒤 관리자가 수정해도 덮어쓰거나 게시 이력을 남기지 않는다', async () => {
    await daily();
    const db = ctx.env.DB;
    const raced = new Proxy(db, {
      get(target, key) {
        if (key === 'batch')
          return async (statements: D1PreparedStatement[]) => {
            await db
              .prepare("UPDATE board_posts SET body = '관리자 새 내용' WHERE id = 'manual'")
              .run();
            return db.batch(statements);
          };
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(publishReleaseNotes(raced, input(), now)).rejects.toMatchObject({ status: 409 });
    expect((await post())!.body).toBe('관리자 새 내용');
    expect((await ledger()).results).toEqual([]);
  });
  it('같은 항목의 동시 게시에도 글과 이력이 하나만 생긴다', async () => {
    const results = await Promise.allSettled([
      publishReleaseNotes(ctx.env.DB, input(), now),
      publishReleaseNotes(ctx.env.DB, input(), now),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect((await ledger()).results).toHaveLength(1);
    expect(String((await post())!.body).match(/## 1\. 기록실 개선/g)).toHaveLength(1);
    expect((await ctx.env.DB.prepare('SELECT id FROM board_posts').all()).results).toHaveLength(1);
  });
  it('100개 항목도 D1 바인딩 한도를 넘지 않고 이력을 한 번에 쓴다', async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      ...entry,
      id: `entry-${i}`,
      title: '개선',
      items: ['개선했어요'],
    }));
    const result = await publishReleaseNotes(ctx.env.DB, input(entries), now);
    expect(result.publishedIds).toHaveLength(100);
    expect((await ledger()).results).toHaveLength(100);
  });
  it('이력 쓰기가 실패하면 본문 변경까지 롤백한다', async () => {
    await daily();
    const first = await post();
    const db = ctx.env.DB;
    const failing = new Proxy(db, {
      get(target, key) {
        if (key === 'batch')
          return (statements: D1PreparedStatement[]) =>
            db.batch([
              ...statements,
              db.prepare("INSERT INTO app_meta (key, value) VALUES ('fail', NULL)"),
            ]);
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(publishReleaseNotes(failing, input(), now)).rejects.toThrow();
    expect(await post()).toEqual(first);
    expect((await ledger()).results).toEqual([]);
  });
});
