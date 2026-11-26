import { test, expect, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-834 크리스마스 이벤트 카드: 기기 시계로 기간(12/19~1/4 KST) 안일 때만 서버에 묻고, 홈을 오가도 5분 안에는 다시 묻지 않는다.
// 조건을 채운 양말은 카드에서 바로 받고, 트리는 시트에서 단계별로 받는다.

const sock = (key: string, reward: object, done: boolean, claimed = false) => ({
  key,
  reward,
  done,
  claimed,
});
function eventOf(over: { claimed?: string[]; owner?: boolean } = {}) {
  const c = new Set(over.claimed ?? []);
  return {
    phase: 'open',
    startAt: '2026-12-18T15:00:00.000Z',
    treeEndAt: '2026-12-25T15:00:00.000Z',
    endAt: '2027-01-04T15:00:00.000Z',
    owner: over.owner ?? true,
    socks: [
      sock('start', { reroll: 3 }, true, c.has('sock:start')),
      sock('retire', { reroll: 3, boost: 2 }, false),
      sock('team', { scout: 1, boost: 2 }, false),
    ],
    tree: {
      count: 4_200,
      goal: 12_000,
      mine: 1,
      counting: true,
      steps: [
        { pct: 25, reward: { reroll: 2 }, reached: true, claimed: c.has('tree:1') },
        { pct: 50, reward: { boost: 1 }, reached: false, claimed: false },
        { pct: 75, reward: { reroll: 2 }, reached: false, claimed: false },
        { pct: 100, reward: { scout: 1, boost: 1 }, reached: false, claimed: false },
      ],
    },
    title: false,
  };
}

async function stub(page: Page, now: string) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  const calls = { get: 0, post: [] as string[] };
  const claimed: string[] = [];
  await page.route(`${API}/v1/events/xmas`, (r) => {
    calls.get++;
    return r.fulfill(ok(eventOf({ claimed })));
  });
  await page.route(`${API}/v1/events/xmas/claim`, (r) => {
    const { target } = r.request().postDataJSON() as { target: string };
    calls.post.push(target);
    claimed.push(target);
    const reward = target === 'tree:1' ? { reroll: 2 } : { reroll: 3 };
    return r.fulfill(
      ok({
        event: eventOf({ claimed }),
        granted: { boost: 0, scout: 0, rename: 0, ...reward },
        title: false,
      }),
    );
  });
  return calls;
}

test('기간 밖이면 카드도 요청도 없다', async ({ page }) => {
  const calls = await stub(page, '2026-12-10T03:00:00Z');
  await page.goto('/');
  await expect(page.locator('[data-act="new"]').first()).toBeVisible();
  await expect(page.locator('[data-home-xmas]')).toHaveCount(0);
  expect(calls.get).toBe(0);
});

test('기간 중: 양말을 카드에서 받고, 트리 단계를 시트에서 받는다(홈을 오가도 다시 묻지 않는다)', async ({
  page,
}) => {
  const calls = await stub(page, '2026-12-20T03:00:00Z');
  await page.goto('/');
  const card = page.locator('[data-home-xmas]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-xmas-sock="start"]')).toHaveAttribute('data-state', 'ready');
  await expect(card.locator('[data-xmas-sock="retire"]')).toHaveAttribute('data-state', 'todo');
  await expect(card).toContainText('35% 채웠어요');

  await card.locator('[data-xmas-sock="start"]').click();
  await expect(page.locator('.toast')).toContainText('양말을 열었어요. 리롤권 3장');
  await expect(card.locator('[data-xmas-sock="start"]')).toHaveAttribute('data-state', 'claimed');

  await card.locator('[data-xmas-sock="retire"]').click();
  const sockSheet = page.locator('[data-xmas-sock-sheet="retire"]');
  await expect(sockSheet).toContainText('나이와 상관없이 선수를 은퇴시키면 열려요.');
  await sockSheet.locator('[data-act="xmas-close"]').click();

  await card.locator('[data-act="xmas-tree"]').click();
  const tree = page.locator('[data-xmas-tree-sheet]');
  await expect(tree).toContainText('은퇴 커리어 4,200 / 12,000');
  await tree.locator('[data-act="xmas-tree-claim"]').click();
  await expect(page.locator('.toast')).toContainText('트리 25% 보상을 받았어요. 리롤권 2장');
  await expect(tree.locator('[data-xmas-step="1"]')).toContainText('받았어요');
  await tree.locator('[data-act="xmas-close"]').click();
  expect(calls.post).toEqual(['sock:start', 'tree:1']);

  // 다른 화면에 갔다 와도 메모(5분) 안이라 다시 묻지 않는다. 받기 뒤 한 번만 새로 받는다.
  const before = calls.get;
  await page.locator('[data-act="dex"]').click();
  await page.goBack();
  await expect(card).toBeVisible();
  expect(calls.get).toBeLessThanOrEqual(before + 1);
});
