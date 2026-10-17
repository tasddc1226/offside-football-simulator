import { test, expect } from '@playwright/test';
import { ok, API } from './helpers.js';

// T-11-333 확률과 공정성 → 밸런스 변경 이력: 서버 밸런스 버전과 코드 배포 패치를 섞어 적용 순으로 보여 주고,
// 패치는 그때 올린 업데이트 소식으로 이어진다. 이력은 접힌 칸을 펼칠 때만 한 번 부른다.
const HISTORY = {
  versions: [
    { version: 1, values: { potMean: 76 }, activatedAt: '2026-10-20T00:00:00.000Z', active: true },
  ],
  patches: [
    {
      id: 't-11-229-growth-targetman',
      appliedAt: '2026-10-12T16:28:05.431Z',
      title: { ko: '타겟맨 훈련과 잠재력 근처 성장이 좋아졌어요' },
      items: { ko: ['OVR이 잠재력에 닿은 뒤에도 훈련하면 조금씩 더 자라요.'] },
      changes: [{ key: 'potGrowthFloor', from: 0.04, to: 0.15 }],
      postId: 'pst_release_20261013',
    },
  ],
};

test('밸런스 변경 이력: 버전과 코드 업데이트 패치를 적용 순으로, 패치는 업데이트 소식으로', async ({
  page,
}) => {
  let historyCalls = 0;
  await page.route(`${API}/v1/balance/history`, (route) => {
    historyCalls++;
    return route.fulfill(ok(HISTORY));
  });
  await page.goto('/');
  await page.locator('[data-act="dex"]').click();
  await page.locator('#fairness > summary').click();
  expect(historyCalls).toBe(0);

  const fold = page.locator('[data-fair-history]');
  await fold.locator('summary').click();
  const rows = fold.locator('.fair-versions > li');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('data-fair-row', 'version');
  await expect(rows.nth(0)).toContainText('버전 1');
  await expect(rows.nth(0)).toContainText('75 → 76');
  await expect(rows.nth(1)).toHaveAttribute('data-fair-row', 'patch');
  await expect(rows.nth(1)).toContainText('코드 업데이트');
  await expect(rows.nth(1)).toContainText('타겟맨 훈련과 잠재력 근처 성장이 좋아졌어요');
  await expect(rows.nth(1)).toContainText('×0.04 → ×0.15');
  expect(historyCalls).toBe(1);

  // 접고 다시 펼쳐도 같은 요청을 다시 보내지 않는다(10분 메모).
  await fold.locator('summary').click();
  await fold.locator('summary').click();
  await expect(rows).toHaveCount(2);
  expect(historyCalls).toBe(1);

  await rows.nth(1).locator('[data-act="fair-patch-note"]').click();
  await expect(page.locator('[data-board="release"]')).toBeVisible();
});
