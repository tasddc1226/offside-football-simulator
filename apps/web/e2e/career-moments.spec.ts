import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);
const club = { id: 'pl-0', name: '맨체스터 스카이블루', leagueId: 'pl', str: 87 };
const pro = {
  ...fixture,
  age: 23,
  club,
  leagueId: 'pl',
  phase: 2,
  fame: 45,
  flags: {},
  story: {},
  chains: [],
};
const trophies = ['UEFA 챔피언스리그 우승', '프리미어리그 우승', 'FA컵 우승'];
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));

for (const width of [320, 390]) {
  test(`우승 결산 ${width}px에 세 트로피가 겹치지 않고 재접속 뒤에도 유지된다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await resumeWithSave(page, {
      ...pro,
      pending: {
        type: 'market',
        m: null,
        res: {
          rec: fixture.career[0],
          trophies,
          awards: [],
          notes: [],
          gala: [],
          tours: [],
          miles: [],
          titles: [],
        },
      },
    });
    const gallery = page.locator('[data-season-trophies]');
    await expect(gallery.locator('svg')).toHaveCount(3);
    for (const title of trophies)
      await expect(page.locator('#sheet').getByText(title, { exact: true })).toHaveCount(1);
    expect(
      await page
        .locator('.trophy-reveal')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    const before = await saved(page);
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await expect(gallery.locator('svg')).toHaveCount(3);
    expect(await saved(page)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('이적 안내와 계약서·다음 시즌 실제 대륙 대회가 일치하고 재열기는 제안을 바꾸지 않는다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const offer = {
    kind: 'offer',
    clubId: club.id,
    name: club.name,
    leagueId: 'pl',
    str: club.str,
    years: 2,
    salary: 5000,
    fee: 0,
    role: '벤치 경쟁',
  };
  await resumeWithSave(page, {
    ...fixture,
    pending: { type: 'market', res: null, m: { options: [offer], note: '', canRetire: false } },
  });
  await expect(page.locator('[data-transfer-outlook]')).toContainText('예상 리그 1위');
  await expect(page.locator('[data-transfer-outlook]')).toContainText(
    '다음 시즌 UEFA 챔피언스리그',
  );
  const before = await saved(page);
  await page.locator('[data-opt="0"]').click();
  await expect(page.locator('.contract')).toContainText('다음 시즌 UEFA 챔피언스리그');
  await page.locator('[data-sign="close"]').click();
  expect(await saved(page)).toEqual(before);
  await page.locator('[data-opt="0"]').click();
  await page.locator('[data-sign="name"]').click();
  await page.locator('[data-sign="ok"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
  expect((await saved(page)).club.id).toBe(club.id);
  await page.locator('[data-act="advance"]').click();
  await expect
    .poll(
      async () =>
        (await saved(page)).season.comps?.find((c: { type: string }) => c.type === 'cont')?.name,
    )
    .toBe('UEFA 챔피언스리그');
});

test('새 해외 라이벌 이름은 선택과 재접속으로 유지되고 기존 이름은 덮어쓰지 않는다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { ...pro, pending: { type: 'event', id: 'rival-1' } });
  const nameText = await page.locator('#sheet p').innerText();
  expect(nameText).toMatch(/올리버|잭|해리|찰리/);
  await page.locator('[data-choice="1"]').click();
  const name = (await saved(page)).flags.rivalName;
  expect(name).toBeTruthy();
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect((await saved(page)).flags.rivalName).toBe(name);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ft_save')!);
    s.flags.rivalName = '김민준';
    s.pending = { type: 'event', id: 'rival-2' };
    localStorage.setItem('ft_save', JSON.stringify(s));
  });
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('#sheet')).toContainText('김민준');
  expect((await saved(page)).flags.rivalName).toBe('김민준');
});

for (const index of [0, 1, 2]) {
  test(`연애설 선택 ${index + 1}은 한 번 처리되고 저장 복원 뒤 다시 열리지 않는다`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await resumeWithSave(page, { ...pro, pending: { type: 'event', id: 'dating-rumor' } });
    await expect(page.locator('#sheet h2')).toHaveText('경기장 밖의 연애설');
    await expect(page.locator('[data-choice]')).toHaveCount(3);
    await page.locator(`[data-choice="${index}"]`).click();
    await expect(page.locator('.result-big')).toBeVisible();
    const after = await saved(page);
    expect(after.evBuf.filter((e: { id: string }) => e.id === 'dating-rumor')).toHaveLength(1);
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await expect(page.locator('#sheet')).toBeHidden();
    expect(await saved(page)).toEqual(after);
  });
}
