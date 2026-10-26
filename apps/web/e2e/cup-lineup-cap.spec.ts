import { expect, test, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-436 편성 화면의 컵 규칙 줄 — 팀 OVR · 구간 상한, 선발 · 최소 인원을 늘 보이고, 서버가 거절할 상태면 저장을 막는다.
const at = (d: number) => `2026-11-${String(d).padStart(2, '0')}T12:00:00.000Z`;
const PLAYERS = [
  {
    careerId: '00000000-0000-4000-8000-000000000011',
    pos: 'FW',
    dpos: 'ST',
    peak: 90,
    roles: { GK: 25, CB: 50, FB: 62, DM: 60, CM: 70, AM: 82, W: 84, ST: 90 },
    attrs: { pac: 88, sho: 91, pas: 70, dri: 84, def: 35, phy: 78 },
    number: 9,
    publicName: '공개 골잡이',
    legendScore: 500,
  },
  {
    careerId: '00000000-0000-4000-8000-000000000012',
    pos: 'GK',
    dpos: null,
    peak: 80,
    roles: null,
    attrs: null,
    number: 1,
    publicName: null,
    legendScore: 300,
  },
];
const base = {
  season: 1,
  edition: 3,
  opensAt: '2026-11-02T12:10:00.000Z',
  closesAt: '2026-11-05T15:00:00.000Z',
  drawAt: '2026-11-06T03:00:00.000Z',
  rounds: [
    { round: 'g1', at: at(6), lockAt: at(6) },
    { round: 'f', at: at(11), lockAt: at(11) },
  ],
  capacity: 128,
};
const divisions = (junior: number) => [
  { id: 's1-3-junior', division: 'junior', ovrMax: junior, entries: 12 },
  { id: 's1-3-senior', division: 'senior', ovrMax: 99, entries: 9 },
  { id: 's1-3-master', division: 'master', ovrMax: null, entries: 20 },
];

async function stub(
  page: Page,
  o: { phase: string; minFilled: number; junior: number; entered: boolean },
) {
  const hits: Record<string, number> = {};
  const puts: unknown[] = [];
  await page.route(`${API}/**`, async (r) => {
    const url = new URL(r.request().url());
    const path = url.pathname;
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true, toss: false },
          googleEmailMasked: 'te***@gmail.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          nickname: '구단주',
        }),
      );
    if (path === '/v1/boards/viewer')
      return r.fulfill(ok({ admin: false, google: true, nickname: '구단주' }));
    if (path === '/v1/owner-team') {
      if (r.request().method() !== 'GET') {
        puts.push(r.request().postDataJSON());
        return r.fulfill({ status: 503, body: '' });
      }
      return r.fulfill(
        ok({
          season: 1,
          current: 1,
          seasons: [{ id: 1, name: '시즌 1' }],
          team: null,
          players: PLAYERS,
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      );
    }
    if (path === '/v1/cups/current')
      return r.fulfill(
        ok({
          cup: {
            ...base,
            id: 's1-3-master',
            division: 'master',
            ovrMax: null,
            minFilled: o.minFilled,
          },
          phase: o.phase,
          entries: 41,
          teams: [],
          groups: [],
          matches: [],
          championTeamId: null,
          divisions: divisions(o.junior),
        }),
      );
    if (path === '/v1/cups/current/me')
      return r.fulfill(
        ok({
          cupId: 's1-3-junior',
          ovr: 50,
          entry: o.entered
            ? {
                teamId: 'tem_00000000-0000-4000-8000-000000000001',
                status: 'active',
                group: 1,
                stage: null,
                createdAt: '2026-11-03T00:00:00.000Z',
              }
            : null,
          eligibility: { ok: !o.entered, reason: null, filled: 0 },
          next: null,
          locked: false,
          rerolls: 0,
        }),
      );
    return r.fulfill({ status: 503, body: '' });
  });
  return { hits, puts };
}

async function openTeam(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-name]').fill('우리 동네 FC');
  await page.locator('[data-team-manager]').fill('홍감독');
  await page.locator('[data-act="team-auto"]').click();
}

test('참가 중 추첨 뒤 구간 상한을 넘으면 줄이 경고색으로 이유를 보이고 저장을 막는다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-07T03:00:00.000Z'));
  const { hits, puts } = await stub(page, {
    phase: 'group',
    minFilled: 2,
    junior: 40,
    entered: true,
  });
  await openTeam(page);
  const band = page.locator('[data-cup-rule="entered"]');
  await expect(band).toContainText('/ 상한 40(주니어)');
  await expect(band).toContainText('선발 2/최소 2');
  await expect(page.locator('[data-cup-rule-ovr]')).toHaveAttribute('data-cup-rule-ovr', 'over');
  await expect(page.locator('[data-cup-rule-filled]')).toHaveAttribute(
    'data-cup-rule-filled',
    'ok',
  );
  const block = '주니어 상한(40)을 넘어서 저장할 수 없어요. 팀 OVR을 40 이하로 맞춰 주세요.';
  await expect(page.locator('[data-cup-rule-note]')).toHaveText(block);
  await expect(page.locator('[data-team-save-reason]')).toHaveText(block);
  await expect(page.locator('[data-act="team-save"]')).toBeDisabled();
  expect(puts).toHaveLength(0);
  expect(hits['/v1/cups/current/me']).toBe(1);
});

test('신청 전 접수 기간에는 들어갈 구간과 모자란 인원을 안내만 하고 저장은 막지 않는다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-03T03:00:00.000Z'));
  const { hits, puts } = await stub(page, {
    phase: 'open',
    minFilled: 8,
    junior: 99,
    entered: false,
  });
  await openTeam(page);
  const band = page.locator('[data-cup-rule="open"]');
  await expect(band).toContainText('/ 상한 99(주니어)');
  await expect(band).toContainText('선발 2/최소 8');
  await expect(page.locator('[data-cup-rule-filled]')).toHaveAttribute(
    'data-cup-rule-filled',
    'short',
  );
  await expect(page.locator('[data-cup-rule-note]')).toHaveText(
    '컵에 신청하려면 선발에 내 선수가 8명 이상 있어야 해요.',
  );
  await expect(page.locator('[data-act="team-save"]')).toBeEnabled();
  await page.locator('[data-act="team-save"]').click();
  await expect.poll(() => puts.length).toBe(1);
  expect(hits['/v1/cups/current/me']).toBe(1);
});
