import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok, openMarket } from './helpers.js';

// T-10-076 영구결번: 은퇴 업로드 응답의 심사 결과로 은퇴 화면에 결번 세리머니를 띄운다. 결번 심사 카드는 이 기기가
// 계산한 구단 기여(프리미어리그 8시즌 · 해마다 리그·챔스 우승 + 발롱도르)로 그린다.
const SLOT = { clubId: 'pl-0', club: '맨체스터 스카이블루', number: 10 };

async function stubRetirement(page: Page, results: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: false, toss: false },
        googleEmailMasked: null,
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: null,
      }),
    ),
  );
  await page.route(/\/v1\/careers\/[^/]+\/seasons\/\d+$/, (r) => r.fulfill(ok({})));
  await page.route(/\/v1\/careers\/([^/]+)\/retirement$/, (r) => {
    bodies.push(r.request().postDataJSON() as Record<string, unknown>);
    const retiredNumber = results[Math.min(bodies.length, results.length) - 1];
    return r.fulfill(ok({ careerId: 'x', status: 'retired', retiredNumber }));
  });
  return bodies;
}

/** 스카이블루에서 8시즌을 뛴 34세로 만들어 은퇴한다. */
async function retireLegend(page: Page) {
  await openMarket(page, 34);
  await page.evaluate((slot) => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    g.career = Array.from({ length: 8 }, (_, i) => ({
      year: g.year - 8 + i,
      age: 26 + i,
      club: slot.club,
      clubId: slot.clubId,
      league: '프리미어리그',
      apps: 38,
      goals: 30,
      assists: 10,
      cs: 0,
      rating: 7.9,
      rank: 1,
      ovr: 88,
      pro: true,
      honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
    }));
    localStorage.setItem('ft_save', JSON.stringify(g));
  }, SLOT);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
}

test('결번을 받으면 심사 카드와 유니폼 세리머니가 나온다', async ({ page }) => {
  await stubRetirement(page, [{ kind: 'granted', ...SLOT, seq: 3, score: 1500 }]);
  await retireLegend(page);
  const rn = page.locator('[data-legend-rn="granted"]');
  await rn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(rn.locator('[data-rn-judge]')).toContainText('영구결번 자격을 채웠어요.');
  await expect(rn).toContainText('10번은 이제,');
  await expect(rn).toContainText('맨체스터 스카이블루 영구결번 · 서버 3번째 결번');
  await expect(page.locator('[data-legend-rn-pill]')).toContainText('결번 10');
  await rn.screenshot({ path: test.info().outputPath('retired-number.png') });

  const axe = await new AxeBuilder({ page }).include('[data-legend-rn]').analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('익명이면 이름 공개를 권하고, 공개하면 결번이 확정된다', async ({ page }) => {
  const bodies = await stubRetirement(page, [
    { kind: 'anonymous', ...SLOT, score: 1500 },
    { kind: 'granted', ...SLOT, seq: 1, score: 1500 },
  ]);
  await page.addInitScript(() => localStorage.setItem('ft_name_public', 'false'));
  await retireLegend(page);
  const anon = page.locator('[data-legend-rn="anonymous"]');
  await expect(anon).toContainText('이름을 공개하면');
  // 장면은 화면 아래 15%를 넘어 들어와야 보인다(스크롤 크레딧).
  await anon.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await anon.locator('[data-act="rn-public"]').click();
  await expect(page.locator('[data-legend-rn="granted"]')).toContainText('서버 1번째 결번');
  expect(bodies.at(-1)?.publicName).toBeTruthy();
});

test('자리가 이미 찼으면 명예의 벽 헌정으로 남는다', async ({ page }) => {
  await stubRetirement(page, [{ kind: 'taken', ...SLOT, holder: '김선배', score: 1500 }]);
  await retireLegend(page);
  await expect(page.locator('[data-legend-rn="taken"]')).toContainText(
    '10번은 이미 김선배의 이름으로 남아 있어',
  );
});

// 배포 전에 은퇴한 기록: 이 기기엔 심사 결과가 없고 서버(소급)에만 있다.
const OLD_ID = '0d000000-0000-4000-8000-00000000000a';
async function seedOldLegend(page: Page) {
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript(
    ({ id, slot }) => {
      const career = Array.from({ length: 8 }, (_, i) => ({
        year: 2030 + i,
        age: 26 + i,
        club: slot.club,
        league: '프리미어리그',
        apps: 38,
        goals: 30,
        assists: 10,
        cs: 0,
        rating: 7.9,
        rank: 1,
        ovr: 88,
        honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
      }));
      localStorage.setItem(
        'ft_hof',
        JSON.stringify([
          {
            id,
            name: '옛레전드',
            pos: 'FW',
            number: 10,
            peak: 90,
            age: 34,
            apps: 304,
            goals: 240,
            assists: 80,
            trophies: 16,
            awards: 8,
            caps: 0,
            ballon: 8,
            lastClub: slot.club,
            score: 1500,
            date: '2026-09-01',
            public: true,
            detail: {
              number: 10,
              pos: 'FW',
              age: 34,
              peak: 90,
              lastClub: slot.club,
              career,
              trophies: [],
              awards: [],
              ballon: [],
              nat: { caps: 0 },
              storyLog: [],
              miles: [],
            },
          },
        ]),
      );
    },
    { id: OLD_ID, slot: SLOT },
  );
}

test('소급으로 받은 결번이 이 기기의 내 선수 배지와 상세 세리머니에 보인다', async ({ page }) => {
  await seedOldLegend(page);
  await page.route(`${API}/v1/retired-numbers`, (r) =>
    r.fulfill(
      ok({
        items: [
          {
            ...SLOT,
            seq: 1,
            score: 1500,
            grantedAt: '2026-09-01T00:00:00.000Z',
            careerId: OLD_ID,
            name: '옛레전드',
            pos: 'FW',
          },
        ],
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-player="0"] [data-rn-chip]')).toHaveText('👑 결번 10');
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-rn-pill]')).toContainText('결번 10');
  await expect(page.locator('[data-legend-rn="granted"]')).toContainText('서버 1번째 결번');
});

test('자리를 못 받은 옛 기록은 상세를 열 때 서버에 물어 명예의 벽 헌정을 보여 준다', async ({
  page,
}) => {
  await seedOldLegend(page);
  await page.route(`${API}/v1/retired-numbers`, (r) => r.fulfill(ok({ items: [] })));
  let asked = 0;
  await page.route(`${API}/v1/careers/${OLD_ID}/retired-number`, (r) => {
    asked++;
    return r.fulfill(
      ok({ retiredNumber: { kind: 'taken', ...SLOT, holder: '김선배', score: 1500 } }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-rn="taken"]')).toContainText('김선배');
  // 결과를 기기에 남겨 다시 열어도 묻지 않는다.
  await page.locator('[data-act="hof-back"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-rn="taken"]')).toContainText('김선배');
  expect(asked).toBe(1);
});
