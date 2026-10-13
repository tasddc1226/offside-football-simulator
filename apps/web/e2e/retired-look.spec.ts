import { expect, test, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { API, ok, fail, retireFromMarket } from './helpers.js';

const ID = '00000000-0000-4000-8000-000000000609';
const archive = {
  id: ID,
  name: '오래전 은퇴 선수',
  number: 8,
  pos: 'MF',
  age: 38,
  peak: 88,
  score: 612,
  date: '2026-09-24',
  apps: 540,
  goals: 120,
  assists: 301,
  trophies: 9,
  awards: 5,
  caps: 88,
  ballon: 1,
  lastClub: '서울 FC',
};
const entry = {
  ...archive,
  name: archive.name,
  retireAge: archive.age,
  legendScore: archive.score,
  retiredAt: '2026-09-24T00:00:00.000Z',
  hasDetail: false,
  look: null as string | null,
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00+09:00'));
  await page.route('https://api.offside-lab.com/**', (r) => r.abort());
});

const policies = new WeakMap<
  Page,
  { look: string | null; remaining: 0 | 1; lockedReason: 'used' | 'transferred' | null }
>();
async function capture(page: Page, name: string) {
  const dir = process.env.QA_CAPTURE_DIR;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}
async function save(dialog: Locator) {
  const button = dialog.locator('[data-act="retired-look-save"]');
  if ((await button.textContent()) === '외형 저장') await button.click();
  await button.click();
}
const savedPolicy = (page: Page, look: string | null) =>
  policies.set(page, { look, remaining: 0, lockedReason: 'used' });
async function setup(page: Page, local = true, owned = true) {
  policies.set(page, { look: null, remaining: 1, lockedReason: null });
  await page.route(`${API}/v1/careers/${ID}/look`, (r) =>
    r.request().method() === 'GET'
      ? r.fulfill(ok({ careerId: ID, ...policies.get(page) }))
      : r.fallback(),
  );
  await page.route(`${API}/v1/hof?**`, (r) => r.fulfill(ok({ entries: [] })));
  await page.route(`${API}/v1/careers/mine`, (r) =>
    r.fulfill(ok({ linked: !local, entries: !local && owned ? [entry] : [] })),
  );
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill(ok({ entry, snapshot: null })));
  if (local)
    await page.addInitScript((h) => {
      if (!localStorage.getItem('ft_hof')) localStorage.setItem('ft_hof', JSON.stringify([h]));
    }, archive);
}
async function openOwn(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="open-owner-players"]').click();
  await page.locator('[data-my-player="0"]').click();
  await page.locator('[data-act="retired-look"]').click();
  return page.getByRole('dialog', { name: '은퇴 선수 꾸미기' });
}

for (const width of [320, 390, 1280])
  test(`old retired player preview/cancel/save/reload, unchanged records (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    const writes: unknown[] = [];
    await page.route(`${API}/v1/careers/${ID}/look`, (r) => {
      if (r.request().method() === 'GET') return r.fallback();
      const body = r.request().postDataJSON() as { look: string | null };
      writes.push(body);
      savedPolicy(page, body.look);
      return r.fulfill(ok({ careerId: ID, look: body.look }));
    });
    let dialog = await openOwn(page);
    const before = await page.evaluate(() => localStorage.getItem('ft_hof'));
    await dialog.locator('[data-look-item="style"] [data-look-opt="6"]').click();
    expect(writes).toEqual([]);
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('ft_hof'))).toBe(before);
    await page.locator('[data-act="retired-look"]').click();
    dialog = page.getByRole('dialog', { name: '은퇴 선수 꾸미기' });
    await dialog.locator('[data-look-item="style"] [data-look-opt="6"]').click();
    await dialog.locator('[data-look-item="expr"] [data-look-opt="2"]').click();
    // The footer remains in view while the option list scrolls; no horizontal overflow.
    await expect(dialog.locator('[data-act="retired-look-save"]')).toBeInViewport();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).include('[data-retired-look]').analyze();
    expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
      [],
    );
    await dialog.locator('[data-act="retired-look-save"]').click();
    await expect(dialog.getByRole('button', { name: '외형 확정', exact: true })).toBeVisible();
    expect(writes).toEqual([]);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await capture(page, `confirm-${width}`);
    await dialog.getByRole('button', { name: '계속 꾸미기', exact: true }).click();
    expect(writes).toEqual([]);
    await save(dialog);
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([{ look: 'y6e2' }]);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_hof')!)[0]);
    expect(saved).toEqual({ ...JSON.parse(before!)[0], look: 'y6e2' });
    // Reload checks the server policy and displays the permanent one-time lock.
    dialog = await openOwn(page);
    await expect(dialog.getByRole('status')).toContainText('은퇴 후 외형 변경 기회를 이미 사용');
    await expect(dialog.locator('[data-act="retired-look-save"]')).toBeDisabled();
    await expect(dialog.locator('[data-look-item]')).toHaveCount(0);
    await capture(page, `used-${width}`);
  });

test('failed save keeps draft and records; retry changes only appearance', async ({ page }) => {
  await setup(page);
  let reject = true;
  await page.route(`${API}/v1/careers/${ID}/look`, (r) => {
    if (r.request().method() === 'GET') return r.fallback();
    if (!reject) savedPolicy(page, r.request().postDataJSON().look);
    return r.fulfill(
      reject
        ? fail(409, 'VALIDATION_FAILED', '소유자를 확인해 주세요.')
        : ok({ careerId: ID, look: r.request().postDataJSON().look }),
    );
  });
  const dialog = await openOwn(page);
  const before = await page.evaluate(() => localStorage.getItem('ft_hof'));
  await dialog.locator('[data-look-item="hair"] [data-look-opt="3"]').click();
  await save(dialog);
  await expect(dialog.getByRole('alert')).toContainText('소유자를 확인');
  expect(await page.evaluate(() => localStorage.getItem('ft_hof'))).toBe(before);
  await dialog.getByRole('button', { name: '계속 꾸미기', exact: true }).click();
  await expect(dialog.locator('[data-look-item="hair"] [data-look-opt="3"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  reject = false;
  await save(dialog);
  await expect(dialog).toBeHidden();
});

test('server-only owner can edit, shared/public viewers cannot', async ({ page }) => {
  await setup(page, false);
  let look: string | null = null;
  await page.route(`${API}/v1/careers/${ID}/look`, (r) => {
    if (r.request().method() === 'GET') return r.fallback();
    look = r.request().postDataJSON().look;
    savedPolicy(page, look);
    return r.fulfill(ok({ careerId: ID, look }));
  });
  const dialog = await openOwn(page);
  await dialog.locator('[data-look-item="style"] [data-look-opt="8"]').click();
  await save(dialog);
  await expect(dialog).toBeHidden();
  expect(look).toBe('y8');
  expect(await page.evaluate(() => localStorage.getItem('ft_hof'))).toBeNull();
  await page.goto(`/career/${ID}`);
  await expect(page.locator('.film-open h1')).toBeVisible();
  await expect(page.locator('[data-act="retired-look"]')).toHaveCount(0);
});

test('retirement screen edits preserve the entire saved game outside look', async ({ page }) => {
  await page.route(/\/v1\/careers\/[^/]+\/look$/, (r) =>
    r.request().method() === 'GET'
      ? r.fulfill(
          ok({
            careerId: r.request().url().split('/').at(-2),
            look: null,
            remaining: 1,
            lockedReason: null,
          }),
        )
      : r.fulfill(
          ok({
            careerId: r.request().url().split('/').at(-2),
            look: r.request().postDataJSON().look,
          }),
        ),
  );
  await retireFromMarket(page, 38);
  await page.locator('[data-act="retired-look"]').click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  const dialog = page.getByRole('dialog', { name: '은퇴 선수 꾸미기' });
  await dialog.locator('[data-look-item="beard"] [data-look-opt="2"]').click();
  await save(dialog);
  await expect(dialog).toBeHidden();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  expect(after).toEqual({
    ...before,
    look: { ...before.look, owned: before.look?.owned ?? [], pick: { beard: 2 } },
  });
});

for (const width of [320, 390, 1280]) {
  test(`transferred career stays locked even when original owner reacquires (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, false);
    policies.set(page, { look: 'y6', remaining: 0, lockedReason: 'transferred' });
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/look') && r.method() === 'PUT') writes.push(r.url());
    });
    const dialog = await openOwn(page);
    await expect(dialog.getByRole('status')).toContainText('재영입해도');
    await expect(dialog.locator('[data-act="retired-look-save"]')).toBeDisabled();
    await expect(dialog.locator('[data-look-item]')).toHaveCount(0);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(writes).toEqual([]);
    await capture(page, `transferred-${width}`);
  });
}

test('unavailable policy never enables editing or issues a write', async ({ page }) => {
  await setup(page);
  await page.route(`${API}/v1/careers/${ID}/look`, (r) =>
    r.fulfill(fail(503, 'INTERNAL_ERROR', '확인 실패')),
  );
  const dialog = await openOwn(page);
  await expect(dialog.getByRole('alert')).toContainText('확인 실패');
  await expect(dialog.locator('[data-act="retired-look-save"]')).toBeDisabled();
  await expect(dialog.locator('[data-look-item]')).toHaveCount(0);
});
