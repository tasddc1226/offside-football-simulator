import { test, expect } from '@playwright/test';
import { retireFromMarket, startCareer } from './helpers.js';

// 옛 저장본 이관(T-10-036). 커리어 ID(cid) 도입 전에 은퇴한 선수는 서버에 커리어가 없어 은퇴만 보내면 400으로
// 버려졌다. 아주 오래된 저장 키(sl_save)는 ft_save가 비어 있을 때마다 되살아났다.
const API = 'http://localhost:8787';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const profile = { data: { id: 'u1', linked: { google: false, toss: false }, googleEmailMasked: null, recoveryCodeIssuedAt: null, createdAt: '2026-01-01T00:00:00.000Z', nickname: null } };

test('cid 없는 옛 은퇴 저장본은 시즌을 먼저 올려 커리어를 만든 뒤 은퇴를 올리고, 새 cid를 저장한다', async ({ page }) => {
  await retireFromMarket(page, 34);
  await page.locator('[data-act="credits-skip"]').click();
  // cid·상세 도입 전 모양으로 되돌린다(업로드 대기열도 비운다).
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    delete g.cid;
    // 이적 시장에서 바로 은퇴해 시즌 기록이 없다 — 실제 옛 은퇴 선수처럼 한 시즌을 채운다.
    if (!g.career.length) {
      g.career.push({ year: 2026, age: 18, club: '테스트고', league: '고교리그', apps: 10, goals: 3, assists: 1, cs: 0, rating: 6.8, rank: 3, ovr: 60, honors: [] });
    }
    localStorage.setItem('ft_save', JSON.stringify(g));
    const hof = JSON.parse(localStorage.getItem('ft_hof')!) as Record<string, unknown>[];
    for (const h of hof) {
      delete h.id;
      delete h.detail;
    }
    localStorage.setItem('ft_hof', JSON.stringify(hof));
    localStorage.removeItem('ft_outbox');
  });

  const puts: string[] = [];
  await page.route(`${API}/v1/profile`, (r) => r.fulfill(json(profile)));
  await page.route(/\/v1\/careers\/[^/]+\/(seasons\/\d+|retirement)$/, async (r) => {
    puts.push(new URL(r.request().url()).pathname);
    await r.fulfill(json({ data: {} }));
  });
  await page.reload();

  const cid = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).cid as string);
  expect(cid).toMatch(/^[0-9a-f-]{36}$/);
  await expect.poll(() => puts.at(-1)).toBe(`/v1/careers/${cid}/retirement`);
  expect(puts.length).toBeGreaterThan(1);
  expect(puts.slice(0, -1).every((p) => p.startsWith(`/v1/careers/${cid}/seasons/`))).toBe(true);
  // 명예의 전당 항목도 같은 cid를 가진다 — 다시 불러와도 새 cid를 만들지 않는다.
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('ft_hof')!) as { id?: string }[])[0]?.id)).toBe(cid);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).cid)).toBe(cid);
});

test('옛 저장 키(sl_save)는 한 번만 ft_save로 옮기고 지운다 — 이후 ft_save가 비어도 되살아나지 않는다', async ({ page }) => {
  await startCareer(page);
  await page.evaluate(() => {
    localStorage.setItem('sl_save', localStorage.getItem('ft_save')!);
    localStorage.removeItem('ft_save');
  });
  await page.reload();
  await expect(page.locator('[data-act="continue"]')).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('sl_save'), !!localStorage.getItem('ft_save')])).toEqual([null, true]);

  // 새 커리어를 막 시작해 ft_save가 아직 없는 상태를 흉내 낸다 — 옛 선수가 돌아오면 안 된다.
  await page.evaluate(() => localStorage.removeItem('ft_save'));
  await page.reload();
  await expect(page.locator('[data-act="continue"]')).toHaveCount(0);
});
