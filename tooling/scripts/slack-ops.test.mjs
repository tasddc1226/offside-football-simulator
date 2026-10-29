import { describe, it, expect, vi } from 'vitest';
import { deliverOnce, discordMessage, sendSlack, slackMessage } from './slack-ops-client.mjs';
import { previousKstDay, monitor, daily } from './slack-ops.mjs';
import { parseCommunity, isFeedback, issueUpdate } from './slack-feedback.mjs';
import { storeMail } from './slack-store-mail.mjs';
const now = Date.parse('2026-10-12T00:00:00Z');
function dbFake(values = {}) {
  const state = new Map(Object.entries(values));
  return {
    get: vi.fn(async (k) => state.get(k) ?? null),
    set: vi.fn(async (k, v) => state.set(k, v)),
    query: vi.fn(async () => [{ n: 3 }]),
    state,
  };
}
const hooks = {
  SLACK_ALERTS_WEBHOOK: 'https://discord.com/api/webhooks/1/test',
  SLACK_DAILY_WEBHOOK: 'https://discord.com/api/webhooks/1/daily',
  SLACK_PURCHASES_WEBHOOK: 'https://discord.com/api/webhooks/1/billing',
};
const ok = () => new Response('ok');
describe('operations delivery and time boundaries', () => {
  it('uses complete previous KST day, including year and UTC boundaries', () => {
    expect(previousKstDay(now)).toEqual({
      day: '2026-10-11',
      start: '2026-10-10T15:00:00.000Z',
      end: '2026-10-11T15:00:00.000Z',
    });
    expect(previousKstDay(Date.parse('2027-01-01T00:00:00Z')).day).toBe('2026-12-31');
  });
  it('does not commit failure; deduplicates only after Slack accepts', async () => {
    const db = dbFake();
    const f = vi.fn(async () => new Response('no', { status: 429 }));
    await expect(
      deliverOnce(
        db,
        'slack:ops:test',
        'v',
        hooks.SLACK_ALERTS_WEBHOOK,
        slackMessage('test', ['body']),
        f,
      ),
    ).rejects.toThrow();
    expect(db.set).not.toHaveBeenCalled();
    f.mockImplementation(ok);
    await deliverOnce(db, 'slack:ops:test', 'v', hooks.SLACK_ALERTS_WEBHOOK, {}, f);
    expect(await deliverOnce(db, 'slack:ops:test', 'v', hooks.SLACK_ALERTS_WEBHOOK, {}, f)).toBe(
      false,
    );
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('neutralizes mentions in fallback while keeping block text literal', () => {
    const m = slackMessage('feedback', ['<!channel>']);
    expect(m.text).not.toContain('<!channel>');
    expect(m.blocks[1].text.type).toBe('plain_text');
  });
  it('suppresses repeat health issues for six hours, then sends one recovery', async () => {
    const health = { at: now, sizeBytes: 2e9, issues: ['backup-not-completed'], daysToLimit: 50 };
    const db = dbFake({ 'cron:infra-health:last': health });
    const fetcher = vi.fn(async (url) =>
      String(url).includes('discord.com/api/webhooks')
        ? ok()
        : String(url).endsWith('/v1/health')
          ? Response.json({ data: { ok: true } })
          : new Response('web'),
    );
    await monitor(db, hooks, now, fetcher);
    await monitor(db, hooks, now + 1000, fetcher);
    expect(fetcher.mock.calls.filter(([u]) => u.includes('discord.com/api/webhooks'))).toHaveLength(
      1,
    );
    db.state.set('cron:infra-health:last', { ...health, issues: [] });
    await monitor(db, hooks, now + 2000, fetcher);
    expect(fetcher.mock.calls.filter(([u]) => u.includes('discord.com/api/webhooks'))).toHaveLength(
      2,
    );
  });
  it('skips repeated daily queries and never reports test events as live', async () => {
    const db = dbFake();
    db.query.mockImplementation(async (sql) =>
      sql.includes('billing_alerts')
        ? [{ store: 'google', kind: 'purchase', product_id: 'reroll', n: 2 }]
        : [{ n: 3 }],
    );
    const f = vi.fn(async () => ok());
    await daily(db, hooks, now, f);
    const calls = db.query.mock.calls.length;
    await daily(db, hooks, now, f);
    expect(db.query.mock.calls).toHaveLength(calls);
    expect(f).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toContain('test=0');
  });
});
describe('feedback source boundaries', () => {
  it('extracts only actual community rows; ignores ads/notices and foreign links', () => {
    const row = (id, href, title, type = 'icon_txt') =>
      `<tr data-no="${id}" data-type="${type}"><td class="gall_tit ub-word"><a href="${href}"><em></em>${title}</a></td></tr>`;
    const html =
      'gall_list' +
      row(1, '/mgallery/board/view/?id=offsidegame&no=1', '공지', 'icon_notice') +
      row(2, 'https://evil.test/', '버그') +
      row(3, '/mgallery/board/view/?id=offsidegame&no=3', '버그 &amp; 문의');
    expect(parseCommunity(html)).toEqual([
      {
        id: 3,
        title: '버그 & 문의',
        url: 'https://gall.dcinside.com/mgallery/board/view/?id=offsidegame&no=3',
      },
    ]);
    expect(() => parseCommunity('blocked')).toThrow();
    expect(isFeedback('오류 문의')).toBe(true);
    expect(isFeedback('내 선수 자랑')).toBe(false);
  });
  it('does not equate an issue closing with production deployment', async () => {
    const db = dbFake();
    const f = vi.fn(async () => ok());
    await issueUpdate(
      db,
      { SLACK_FEEDBACK_WEBHOOK: hooks.SLACK_ALERTS_WEBHOOK },
      {
        action: 'closed',
        issue: {
          number: 1,
          title: 'test',
          html_url: 'https://github.com/tasddc1226/offside-football-simulator/issues/1',
          state: 'closed',
          updated_at: 'today',
          labels: [{ name: 'feedback' }],
        },
      },
      f,
    );
    expect(JSON.parse(f.mock.calls[0][1].body).content).toContain('운영 반영 여부 확인 필요');
  });
});
describe('store mail boundaries', () => {
  const row = {
    id: '1a1234567890abcd',
    store: 'google',
    from: `review-fixture${'@'}google.com`,
    authenticated: true,
    subject: '오프사이드 app approved',
    appEvidence: 'com.offsidelab.app',
    receivedAt: '2026-10-12T00:00:00Z',
  };
  it('rejects unrelated/spoofed mail and ignores historical purchase receipts', () => {
    expect(storeMail(row, '2026-10-11T00:00:00Z').text).toContain('심사·출시 메일');
    expect(
      storeMail({ ...row, subject: 'Test: Order Receipt' }, '2026-10-11T00:00:00Z'),
    ).toBeNull();
    expect(storeMail(row, '2026-10-13T00:00:00Z')).toBeNull();
    expect(() => storeMail({ ...row, from: 'fake@evil.test' }, '2026-10-11T00:00:00Z')).toThrow();
    expect(() => storeMail({ ...row, authenticated: false }, '2026-10-11T00:00:00Z')).toThrow();
  });
});

describe('feedback collection retries', () => {
  it('baselines old posts and retries a failed new candidate without advancing', async () => {
    const { collectFeedback } = await import('./slack-feedback.mjs');
    const db = dbFake();
    let id = 10;
    let fail = true;
    const fetcher = vi.fn(async (url) => {
      if (url.includes('discord.com/api/webhooks'))
        return new Response(fail ? 'fail' : 'ok', { status: fail ? 500 : 200 });
      return new Response(
        `gall_list<tr data-no="${id}"><td class="gall_tit"><a href="/mgallery/board/view/?id=offsidegame&no=${id}">버그 문의</a></td></tr><tr data-no="9"><td class="gall_tit"><a href="/mgallery/board/view/?id=offsidegame&no=9">자랑</a></td></tr>`,
      );
    });
    const env = { SLACK_FEEDBACK_WEBHOOK: hooks.SLACK_ALERTS_WEBHOOK };
    await collectFeedback(db, env, fetcher, now);
    expect(db.state.get('slack:ops:feedback-community').lastId).toBe(10);
    id = 11;
    await expect(collectFeedback(db, env, fetcher, now)).rejects.toThrow();
    expect(db.state.get('slack:ops:feedback-community').lastId).toBe(10);
    fail = false;
    db.query.mockResolvedValue([]);
    await collectFeedback(db, env, fetcher, now);
    expect(db.state.get('slack:ops:feedback-community').lastId).toBe(11);
  });
});

describe('release reporting', () => {
  it('keeps web/API success separate from OTA failure and ignores preflight', async () => {
    const { releaseUpdate } = await import('./slack-release.mjs');
    const db = dbFake();
    const event = {
      workflow_run: {
        id: 123,
        name: 'Production Release',
        head_branch: 'main',
        status: 'completed',
        head_sha: 'abcd1234',
        run_attempt: 1,
        conclusion: 'failure',
      },
    };
    const f = vi.fn(async (url) =>
      url.includes('api.github.com')
        ? Response.json({
            total_count: 2,
            jobs: [
              { name: 'Deploy production', conclusion: 'success' },
              { name: 'OTA 1.1.2 / iOS', conclusion: 'failure' },
            ],
          })
        : ok(),
    );
    await releaseUpdate(
      db,
      { SLACK_RELEASES_WEBHOOK: hooks.SLACK_ALERTS_WEBHOOK, GITHUB_TOKEN: 'fake' },
      event,
      f,
    );
    const payload = JSON.parse(f.mock.calls[1][1].body);
    expect(payload.content).toContain('웹·API 배포: 성공');
    expect(payload.content).toContain('OTA 1.1.2 / iOS: 실패');
    f.mockImplementation(async () =>
      Response.json({
        total_count: 1,
        jobs: [{ name: 'Preflight production', conclusion: 'success' }],
      }),
    );
    await releaseUpdate(db, {}, event, f);
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe('discord webhook delivery (T-11-576)', () => {
  const hook = 'https://discord.com/api/webhooks/123/abc-DEF_9';
  it('sends title, lines and links as one plain content with mentions off', async () => {
    const m = slackMessage(
      '🚨 점검 필요',
      ['D1 <@here>', '두 번째'],
      [{ label: 'Actions', url: 'https://github.com/x' }],
    );
    expect(discordMessage(m)).toEqual({
      content: '🚨 점검 필요\nD1 <@here>\n두 번째\n[Actions](<https://github.com/x>)',
      allowed_mentions: { parse: [] },
      flags: 4,
    });
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    await sendSlack(hook, m, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).content).toMatch(/^🚨 점검 필요/);
  });
  it('rejects other discord paths and fails on non-2xx', async () => {
    await expect(
      sendSlack('https://discord.com/api/channels/1/messages', slackMessage('a', [])),
    ).rejects.toThrow('Invalid notify destination');
    const fetcher = vi.fn(async () => new Response('{}', { status: 404 }));
    await expect(sendSlack(hook, slackMessage('a', []), fetcher)).rejects.toThrow('HTTP 404');
  });
});
