import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { resumeWithSave, settleBlock } from './helpers.js';

// T-11-261 대륙 대회 녹아웃 대진: 리그 페이즈를 통과한 뒤 시즌 탭에 다음 상대가 보이고, 후반기를 치르면 내 팀 경로가
// 남는다. 화면은 엔진이 저장한 상대·결과만 그린다 — 새로고침·언어 전환에도 같은 상대다.
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);
const club = { id: 'pl-0', name: '맨체스터 스카이블루', leagueId: 'pl', str: 87 };
/** 전반기까지 마친 빅클럽 주전: 챔피언스리그 리그 페이즈 통과(16강 직행), 16강 상대는 미리 추첨돼 있다. */
const ucl = {
  type: 'cont',
  key: 'UCL',
  name: 'UEFA 챔피언스리그',
  alive: true,
  stage: '16강 직행',
  pts: 19,
  played: 8,
  apps: 8,
  g: 5,
  a: 2,
  bracket: { path: [], next: { stage: '16강', opp: 'll-0', legs: 2 } },
};
const pro = {
  ...fixture,
  age: 24,
  club,
  leagueId: 'pl',
  phase: 2,
  fame: 45,
  flags: {},
  story: {},
  chains: [],
  pending: null,
  season: {
    ...fixture.season,
    comps: [
      { type: 'cup', name: 'FA컵', alive: true, stage: '16강 통과', apps: 2, g: 1, a: 0 },
      { type: 'cup', name: 'EFL컵', alive: false, stage: '32강 탈락', apps: 1, g: 0, a: 0 },
      ucl,
    ],
    trophiesMid: [],
  },
};
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
const uclBracket = (page: Page) => page.locator('[data-bracket="UCL"]');

/** 후반기(마지막 구간)를 치른다: 중계 시트 확인 → (이어지는 이벤트가 있으면 첫 선택지로 넘긴 뒤) 시즌 결산 시트. 결산 시트는 열어 둔 채 돌려준다. */
async function playSecondHalf(page: Page) {
  await page.locator('[data-act="advance"]').click();
  const sheet = page.locator('#sheet');
  const ok = sheet.locator('[data-sheet="0"]');
  // T-11-390 결정적 장면이 뜨면 감독에게 맡긴다(결과는 장면이 없을 때와 같다).
  await settleBlock(page, 20_000);
  await ok.click();
  const toMarket = sheet.getByRole('button', { name: /이적 시장으로/ });
  const resume = page.locator('[data-act="resume"]').filter({ hasText: '이벤트 확인' });
  await expect(toMarket.or(resume)).toBeVisible({ timeout: 20_000 });
  if (!(await toMarket.isVisible())) {
    await resume.click();
    await page.locator('.choice').first().click();
    const tap = sheet.locator('[data-mg-tap]');
    if (await tap.isVisible()) await tap.click();
    await sheet.locator('[data-sheet]:not([data-mg-tap])').first().click();
  }
  await expect(toMarket).toBeVisible({ timeout: 20_000 });
  return sheet;
}
/** 결산 시트에서 이적 시장으로 간 뒤 창을 닫아 시즌 탭(시즌 종료)을 본다. */
async function closeMarket(page: Page) {
  await page
    .locator('#sheet')
    .getByRole('button', { name: /이적 시장으로/ })
    .click();
  await page.locator('[data-market-close]').click();
  await expect(page.locator('#sheet')).toBeHidden();
}

test('리그 페이즈를 통과하면 다음 상대가 보이고, 후반기를 치르면 경로가 남아 새로고침 뒤에도 같다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, pro);
  await page.locator('[data-tab="season"]').click();
  const next = uclBracket(page).locator('[data-bracket-row="next"]');
  await expect(next).toHaveCount(1);
  await expect(next).toContainText('16강');
  await expect(next).toContainText('vs 마드리드 로스 블랑코스');
  await expect(next).toContainText('다음 상대');

  const review = await playSecondHalf(page);
  // 시즌 결산의 대회별 성적에 녹아웃 경로가 한 줄로 붙는다.
  const path = review.locator('[data-comp-path="UCL"]');
  await expect(path).toContainText('16강');
  await expect(path).toContainText('vs 마드리드 로스 블랑코스');
  await closeMarket(page);
  await page.locator('[data-tab="season"]').click();
  const rows = uclBracket(page).locator('[data-bracket-row]');
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  await expect(rows.first()).toContainText('16강');
  await expect(rows.first()).toContainText('vs 마드리드 로스 블랑코스');
  await expect(uclBracket(page).locator('[data-bracket-row="next"]')).toHaveCount(0);
  // 저장된 경로와 화면이 같고, 마지막 승부 결과가 대회 단계와 맞는다.
  const after = await saved(page);
  const comp = after.season.comps.find((c: { key?: string }) => c.key === 'UCL');
  expect(comp.alive).toBe(false);
  expect(comp.bracket.path).toHaveLength(n);
  expect(comp.bracket.path[0]).toMatchObject({ stage: '16강', opp: 'll-0' });
  const last = comp.bracket.path.at(-1);
  if (comp.stage === '우승') await expect(rows.last()).toContainText('우승');
  else if (comp.stage === '준우승') await expect(rows.last()).toContainText('준우승');
  else {
    expect(last.won).toBe(false);
    await expect(rows.last()).toContainText('탈락');
  }

  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await page.locator('[data-market-close]').click();
  await page.locator('[data-tab="season"]').click();
  await expect(uclBracket(page).locator('[data-bracket-row]')).toHaveCount(n);
  expect(
    (await saved(page)).season.comps.find((c: { key?: string }) => c.key === 'UCL').bracket,
  ).toEqual(comp.bracket);
});

test('대진 기록이 없는 옛 세이브는 상세 없음만 알리고 상대를 만들어 넣지 않는다', async ({
  page,
}) => {
  await resumeWithSave(page, {
    ...pro,
    season: { ...pro.season, comps: [{ ...ucl, bracket: undefined }] },
  });
  await page.locator('[data-tab="season"]').click();
  await expect(uclBracket(page).locator('[data-bracket-note]')).toContainText(
    '이전 라운드 상대 기록이 없어요',
  );
  await expect(uclBracket(page).locator('[data-bracket-row]')).toHaveCount(0);
});
