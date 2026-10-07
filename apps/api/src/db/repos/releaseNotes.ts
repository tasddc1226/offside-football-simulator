import type { PostTranslations, PublishReleaseNotes, ReleaseNote } from '@offside/contracts';
import { POST_BODY_MAX, TRANSLATED_BODY_MAX } from '@offside/contracts/board-limits';
import { conflictError } from '../../routes/shared.js';
import { sha256Hex } from '../hash.js';
import { newsPushStatements } from '../../push/enqueue.js';
import type { Lang } from '../../lang.js';
import { LOCALES, TRANSLATED_LOCALES } from '@offside/contracts/i18n';
import { parseI18n } from './boards.js';

const keyOf = (id: string) => `release-note:${id}`;
type DailyPost = {
  id: string;
  body: string;
  i18n_json: string | null;
  updated_at: string;
  deleted_at: string | null;
};
// 끝인사는 언어를 가리지 않는다 — 번역이 없던 글은 한국어 본문에 영어·일본어 항목을 붙인다.
const THANKS = /(?:^|\n)(?:감사합니다|Thank you|ありがとうございます)[.!。！]?\s*$/;

// T-11-146 날짜 글의 제목·적용 범위 문구·끝인사. 한국어 제목은 오늘 글을 찾는 키라 바꾸지 않는다.
const TEXT: Record<
  Lang,
  {
    title: (yymmdd: string) => string;
    web: string;
    app: string;
    pending: (v: string) => string;
  }
> = {
  ko: {
    title: (d) => `${d} 릴리즈노트`,
    web: '웹에 적용했어요',
    app: '앱에 적용했어요',
    pending: (v) => `웹에 먼저 적용했어요. 앱은 ${v} 업데이트로 제공할 예정이에요`,
  },
  en: {
    title: (d) => `${d} Release notes`,
    web: 'Available on the web',
    app: 'Available in the app',
    pending: (v) => `Available on the web first. The app gets it in the ${v} update`,
  },
  ja: {
    title: (d) => `${d} リリースノート`,
    web: 'Web版に適用しました',
    app: 'アプリに適用しました',
    pending: (v) => `Web版に先に適用しました。アプリは${v}のアップデートで提供する予定です`,
  },
};

export function releaseDay(now: string) {
  const shifted = new Date(new Date(now).getTime() + 9 * 3600_000);
  const day = shifted.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00+09:00`).toISOString();
  const yymmdd = day.slice(2).replaceAll('-', '');
  return {
    day,
    title: TEXT.ko.title(yymmdd),
    titles: Object.fromEntries(LOCALES.map((l) => [l, TEXT[l].title(yymmdd)])) as Record<
      Lang,
      string
    >,
    start,
    end: new Date(new Date(start).getTime() + 86400_000).toISOString(),
  };
}

/** 직접 쓴 본문은 그대로 두고, 마지막 감사 인사 바로 앞에 새 항목만 붙인다. 번역이 없는 항목은 한국어로 붙인다. */
export function appendReleaseNotes(
  body: string,
  entries: ReleaseNote[],
  lang: Lang = 'ko',
): string {
  const t = TEXT[lang];
  const numbers = [...body.matchAll(/^#{1,3}\s+(\d+)\.\s/gm)].map((m) => Number(m[1]));
  let number = Math.max(0, ...numbers);
  const added = entries
    .map((entry) => {
      const { title, items } = (lang !== 'ko' && entry[lang]) || entry;
      const availability =
        entry.availability === 'web-app-pending'
          ? `\n- ${t.pending(entry.appVersion!)}`
          : entry.availability === 'web'
            ? `\n- ${t.web}`
            : entry.availability === 'app'
              ? `\n- ${t.app}`
              : '';
      return `## ${++number}. ${title}\n${items.map((s) => `- ${s}`).join('\n')}${availability}`;
    })
    .join('\n\n');
  const thanks = THANKS.exec(body);
  const split = thanks?.index ?? body.length;
  return `${body.slice(0, split).trimEnd()}\n\n${added}${thanks ? body.slice(split) : ''}`;
}

/** app_meta의 PK 조회로 영구 게시 이력을 읽는다. 글과 이력 쓰기는 D1 batch 한 트랜잭션이다. */
export async function publishReleaseNotes(db: D1Database, input: PublishReleaseNotes, now: string) {
  if (!input.entries.length) return { postId: null, publishedIds: [], updated: false };
  const keys = input.entries.map((e) => keyOf(e.id));
  const hashes = new Map(
    await Promise.all(
      input.entries.map(
        async (entry) =>
          [
            entry.id,
            await sha256Hex(
              JSON.stringify({
                id: entry.id,
                title: entry.title,
                items: entry.items,
                availability: entry.availability,
                appVersion: entry.appVersion,
              }),
            ),
          ] as const,
      ),
    ),
  );
  const seen = await db
    .prepare('SELECT key, value FROM app_meta WHERE key IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(keys))
    .all<{ key: string; value: string }>();
  for (const record of seen.results) {
    const metadata = JSON.parse(record.value) as { hash: string };
    if (metadata.hash !== hashes.get(record.key.slice('release-note:'.length)))
      throw conflictError(
        '게시한 항목의 문구가 바뀌었어요. 정정은 새 ID로 추가해 주세요.',
        'RELEASE_ENTRY_CHANGED',
      );
  }
  const published = new Set(seen.results.map((r) => r.key));
  const pending = input.entries.filter((e) => !published.has(keyOf(e.id)));
  if (!pending.length) return { postId: null, publishedIds: [], updated: false };

  const date = releaseDay(now);
  // board,created_at 인덱스를 쓰는 하루 범위 조회. 삭제된 오늘 글은 자동으로 다시 만들지 않는다.
  const post = await db
    .prepare(
      `SELECT id, body, i18n_json, updated_at, deleted_at FROM board_posts
     WHERE board = 'release' AND created_at >= ? AND created_at < ? AND title = ?
     ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(date.start, date.end, date.title)
    .first<DailyPost>();
  if (post?.deleted_at)
    throw conflictError(
      '오늘 릴리즈 노트가 삭제되어 자동으로 게시하지 않았어요.',
      'RELEASE_POST_DELETED',
    );
  const body = appendReleaseNotes(post?.body ?? date.title, pending);
  // 번역이 없던 오늘 글(이 기능 전에 만든 글)은 한국어 본문에 이어 붙인다.
  const before = parseI18n(post?.i18n_json ?? null);
  const translated = TRANSLATED_LOCALES.map((lang) => {
    const prev = before[lang];
    const base = prev?.body ?? (post ? post.body : date.titles[lang]);
    return [
      lang,
      { title: prev?.title ?? date.titles[lang], body: appendReleaseNotes(base, pending, lang) },
    ] as const;
  });
  const i18n: PostTranslations = Object.fromEntries(translated);
  if (
    body.length > POST_BODY_MAX ||
    translated.some(([, t]) => t.body.length > TRANSLATED_BODY_MAX)
  )
    throw conflictError('오늘 릴리즈 노트의 글자 수 한도를 넘었어요.', 'RELEASE_POST_FULL');
  const i18nJson = JSON.stringify(i18n);
  const postId = post?.id ?? `pst_release_${date.day.replaceAll('-', '')}`;
  const publishedIds = pending.map((e) => e.id);
  if (input.dryRun) return { postId, publishedIds, updated: false, preview: body };

  // 같은 밀리초의 수정도 알림에 잡히게 마지막 수정 시각보다 최소 1ms 늦게 쓴다.
  const updated = new Date(
    Math.max(new Date(now).getTime(), post ? new Date(post.updated_at).getTime() + 1 : 0),
  ).toISOString();
  const pendingKeys = pending.map((e) => keyOf(e.id));
  const unclaimed =
    'NOT EXISTS (SELECT 1 FROM app_meta WHERE key IN (SELECT value FROM json_each(?)))';
  const write = post
    ? db
        .prepare(
          `UPDATE board_posts SET body = ?, i18n_json = ?, updated_at = ?
        WHERE id = ? AND body = ? AND updated_at = ? AND deleted_at IS NULL AND ${unclaimed}`,
        )
        .bind(
          body,
          i18nJson,
          updated,
          postId,
          post.body,
          post.updated_at,
          JSON.stringify(pendingKeys),
        )
    : db
        .prepare(
          `INSERT OR IGNORE INTO board_posts
        (id, board, title, body, i18n_json, author_profile_id, created_at, updated_at)
        SELECT ?, 'release', ?, ?, ?, 'release-automation', ?, ? WHERE ${unclaimed}`,
        )
        .bind(postId, date.title, body, i18nJson, now, updated, JSON.stringify(pendingKeys));
  // changes()는 같은 batch의 직전 DML 변경 수. CAS가 실패하면 이력도 no-op이다.
  // JSON 한 바인딩으로 모든 이력을 쓰므로 D1의 바인딩 100개 제한과 요청 수를 지킨다.
  // 이력 충돌 등 어떤 문장이라도 실패하면 본문까지 모두 롤백한다.
  const results = await db.batch([
    write,
    db
      .prepare(
        `INSERT INTO app_meta (key, value)
      SELECT 'release-note:' || json_extract(value, '$.id'), json_remove(value, '$.id')
      FROM json_each(?) WHERE changes() = 1`,
      )
      .bind(
        JSON.stringify(
          pending.map((entry) => ({
            id: entry.id,
            postId,
            sha: input.sha,
            publishedAt: updated,
            hash: hashes.get(entry.id),
          })),
        ),
      ),
    // 기존 글에 항목을 추가해도 푸시를 다시 보내지 않는다.
    ...(!post ? newsPushStatements(db, postId, 'release', now) : []),
  ]);
  if (results[0]!.meta.changes !== 1)
    throw conflictError(
      '릴리즈 노트가 다른 작업에서 수정됐어요. 다시 실행해 주세요.',
      'RELEASE_POST_CONFLICT',
    );
  return { postId, publishedIds, updated: true };
}
