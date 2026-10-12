import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { deliverOnce, productionDb, sendSlack, slackMessage } from './slack-ops-client.mjs';

export const COMMUNITY = 'https://gall.dcinside.com/mgallery/board/lists/?id=offsidegame';
const REPO = 'https://github.com/tasddc1226/offside-football-simulator';
export const isFeedback = (s) =>
  /버그|오류|안되|안돼|안 됨|안됨|튕|깨지|불편|개선|건의|제안|문의|피드백|bug|error|feedback|suggestion/i.test(
    s,
  );
function text(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);/g,
      (v) =>
        ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[
          v
        ],
    )
    .replace(/\s+/g, ' ')
    .trim();
}
export function parseCommunity(html) {
  if (!html.includes('gall_list')) throw new Error('Community listing unavailable');
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*data-no="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    if (/icon_notice/.test(match[0])) continue;
    const anchor = match[2].match(
      /<td[^>]*class="gall_tit[^>]*>[\s\S]*?<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
    );
    if (!anchor) continue;
    const u = new URL(anchor[1].replace(/&amp;/g, '&'), COMMUNITY);
    if (
      u.origin !== 'https://gall.dcinside.com' ||
      u.pathname !== '/mgallery/board/view/' ||
      u.searchParams.get('id') !== 'offsidegame' ||
      u.searchParams.get('no') !== match[1]
    )
      continue;
    rows.push({
      id: Number(match[1]),
      title: text(anchor[2]).slice(0, 200),
      url: `https://gall.dcinside.com/mgallery/board/view/?id=offsidegame&no=${match[1]}`,
    });
  }
  if (!rows.length) throw new Error('Community listing malformed or empty');
  return rows;
}
export function issueLink(title, source) {
  const u = new URL(`${REPO}/issues/new`);
  u.searchParams.set('labels', 'feedback');
  u.searchParams.set('title', `[피드백 검토] ${title.slice(0, 100)}`);
  u.searchParams.set(
    'body',
    `출처: ${source}\n\n## 검증\n- [ ] 실제 버그인지 재현\n- [ ] 기존 이슈/PR 중복 확인\n- [ ] 시즌 중 밸런스 영향이 있으면 운영자 확인\n\n## 처리\n수정 PR: \n운영 반영: \n`,
  );
  return u.toString();
}
export async function collectFeedback(db, env, fetcher = fetch, now = Date.now()) {
  const previous = await db.get('slack:ops:feedback-community');
  const all = [];
  let complete = false;
  // At most three listing pages hourly. Never fetch post bodies, identities, or images.
  for (let page = 1; page <= 3; page++) {
    const r = await fetcher(`${COMMUNITY}&page=${page}`, {
      headers: { 'user-agent': 'Mozilla/5.0 OFFSIDE-operations' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error('Community fetch failed');
    const rows = parseCommunity(await r.text());
    all.push(...rows);
    if (!previous || rows.some((x) => x.id <= previous.lastId)) {
      complete = true;
      break;
    }
  }
  if (!complete) throw new Error('Community cursor gap; inspect manually before advancing');
  const maxId = Math.max(...all.map((x) => x.id));
  if (!previous) {
    await db.set('slack:ops:feedback-community', {
      lastId: maxId,
      initializedAt: new Date(now).toISOString(),
    });
  } else {
    const candidates = [
      ...new Map(
        all.filter((x) => x.id > previous.lastId && isFeedback(x.title)).map((x) => [x.id, x]),
      ).values(),
    ].sort((a, b) => a.id - b.id);
    // Cursor advances per accepted message. Failed delivery stays retryable.
    for (const x of candidates) {
      await sendSlack(
        env.SLACK_FEEDBACK_WEBHOOK,
        slackMessage(
          '💬 커뮤니티 피드백 검토 후보',
          [
            x.title,
            '제목의 키워드로 수집한 후보이며 확인된 버그가 아닙니다. 원문을 읽고 재현 여부를 검토하세요.',
          ],
          [
            { label: '원문 보기', url: x.url },
            { label: '검토 이슈 만들기', url: issueLink(x.title, x.url) },
          ],
        ),
        fetcher,
      );
      await db.set('slack:ops:feedback-community', { lastId: x.id });
    }
    await db.set('slack:ops:feedback-community', { lastId: Math.max(previous.lastId, maxId) });
  }
  const commentKey = 'slack:ops:feedback-comments';
  const cursor = await db.get(commentKey);
  if (!cursor) {
    await db.set(commentKey, { at: new Date(now).toISOString(), id: '' });
    return;
  }
  const rows = await db.query(
    'SELECT c.id,c.created_at,c.body,c.post_id,p.title,p.board FROM board_comments c JOIN board_posts p ON p.id=c.post_id WHERE c.created_at>=? AND (c.created_at>? OR c.id>?) AND c.deleted_at IS NULL AND c.admin=0 AND p.deleted_at IS NULL ORDER BY c.created_at,c.id LIMIT 100',
    [cursor.at, cursor.at, cursor.id],
  );
  for (const x of rows) {
    if (isFeedback(x.body)) {
      const source = `https://offside-lab.com/?news=${encodeURIComponent(x.post_id)}&board=${encodeURIComponent(x.board)}`;
      await sendSlack(
        env.SLACK_FEEDBACK_WEBHOOK,
        slackMessage(
          '💬 앱·웹 댓글 피드백 검토 후보',
          [
            `게시글: ${x.title.slice(0, 200)}`,
            `댓글 참조: ${x.id}`,
            '닉네임·댓글 본문은 알림에 복사하지 않습니다. 원문에서 내용을 확인하세요.',
          ],
          [
            { label: '원문 보기', url: source },
            { label: '검토 이슈 만들기', url: issueLink('앱·웹 댓글 검토', source) },
          ],
        ),
        fetcher,
      );
    }
    await db.set(commentKey, { at: x.created_at, id: x.id });
  }
}
export async function issueUpdate(db, env, event, fetcher = fetch) {
  const issue = event.issue;
  if (
    !issue ||
    !issue.labels?.some((x) => x.name === 'feedback') ||
    !['opened', 'closed', 'reopened', 'labeled', 'unlabeled'].includes(event.action)
  )
    return;
  if (!issue.html_url?.startsWith(`${REPO}/issues/`))
    throw new Error('Unexpected issue repository');
  const labels = issue.labels.map((x) => x.name);
  const state = labels.includes('feedback:deployed')
    ? '운영 반영 완료'
    : issue.state === 'closed'
      ? issue.state_reason === 'not_planned'
        ? '종료 · 미진행'
        : '종료 · 운영 반영 여부 확인 필요'
      : labels.includes('feedback:fixing')
        ? '수정 중'
        : labels.includes('feedback:verified')
          ? '재현 확인'
          : '검토 대기';
  const version = JSON.stringify([issue.updated_at, event.action, state, labels.sort()]);
  await deliverOnce(
    db,
    `slack:ops:feedback-issue:${issue.number}`,
    version,
    env.SLACK_FEEDBACK_WEBHOOK,
    slackMessage(
      `📋 피드백 #${issue.number} · ${state}`,
      [
        issue.title.slice(0, 200),
        '실제 운영 반영 확인 후 feedback:deployed 라벨을 붙이세요. 이슈 종료만으로 배포 완료로 표시하지 않습니다.',
      ],
      [{ label: '처리 이슈·수정 PR 보기', url: issue.html_url }],
    ),
    fetcher,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const db = await productionDb();
    if (process.argv[2] === 'issues')
      await issueUpdate(
        db,
        process.env,
        JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      );
    else await collectFeedback(db, process.env);
  } catch {
    console.error('Feedback collection or delivery failed; cursor remains retryable.');
    try {
      await sendSlack(
        process.env.SLACK_ALERTS_WEBHOOK,
        slackMessage('🚨 피드백 수집 실행 실패', [
          '원문 조회 또는 Slack 전송을 확인하세요. 실패를 0건으로 보고하지 않았습니다.',
        ]),
      );
    } catch {
      /* Workflow remains failed if Slack is unavailable. */
    }
    process.exitCode = 1;
  }
}
