import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ownerMemberships, ownerTeams } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T00:00:00.000Z'));
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});
const body = { name: '슬롯 FC', manager: '감독', formation: '4-3-3', slots: Array(11).fill(null) };
const put = (cookie: string, slot: number) =>
  callJson(ctx.env, 'PUT', `/v1/owner-team?slot=${slot}`, { cookie, body });
async function member(profileId: string) {
  await ctx.db.insert(ownerMemberships).values({
    profileId,
    store: 'local',
    environment: 'local',
    chainId: profileId,
    status: 'active',
    paidUntil: '2026-11-12T00:00:00.000Z',
    verifiedAt: new Date().toISOString(),
  });
}
it('preserves the original team and gives an active member exactly three independent slots', async () => {
  const me = await issueGoogleCookie(ctx);
  expect((await put(me.cookie, 0)).status).toBe(200);
  const [original] = await ctx.db.select().from(ownerTeams);
  expect((await put(me.cookie, 1)).status).toBe(409);
  await member(me.profileId);
  for (const slot of [1, 2]) expect((await put(me.cookie, slot)).status).toBe(200);
  expect((await put(me.cookie, 3)).status).toBe(409);
  expect((await put(me.cookie, 1)).status).toBe(200);
  const teams = await ctx.db.select().from(ownerTeams);
  expect(teams).toHaveLength(3);
  expect(teams.find((t) => t.slot === 0)?.id).toBe(original!.id);
  expect(new Set(teams.map((t) => t.id)).size).toBe(3);
  const other = await issueGoogleCookie(ctx);
  expect((await put(other.cookie, 1)).status).toBe(409);
  const r = await callJson(ctx.env, 'GET', '/v1/owner-team?slot=2', { cookie: me.cookie });
  expect(await r.json()).toMatchObject({
    data: { selectedSlot: 2, slotLimit: 3, slotEditable: true, teamSlots: expect.any(Array) },
  });
});
it('keeps expired extra teams readable but rejects edits, presets and friendlies; primary remains editable', async () => {
  const me = await issueGoogleCookie(ctx);
  await member(me.profileId);
  expect((await put(me.cookie, 1)).status).toBe(200);
  await ctx.db
    .update(ownerMemberships)
    .set({ status: 'expired' })
    .where(eq(ownerMemberships.profileId, me.profileId));
  const r = await callJson(ctx.env, 'GET', '/v1/owner-team?slot=1', { cookie: me.cookie });
  expect(await r.json()).toMatchObject({
    data: { slotLimit: 1, slotEditable: false, team: { name: body.name } },
  });
  expect((await put(me.cookie, 1)).status).toBe(409);
  expect((await put(me.cookie, 0)).status).toBe(200);
  expect(
    (
      await callJson(ctx.env, 'PUT', '/v1/owner-team/presets?slot=1', {
        cookie: me.cookie,
        body: { presets: [] },
      })
    ).status,
  ).toBe(409);
  const friends = await callJson(ctx.env, 'GET', '/v1/friends?slot=1', { cookie: me.cookie });
  expect(await friends.json()).toMatchObject({ data: { canPlay: false } });
  expect(
    (
      await callJson(ctx.env, 'POST', '/v1/friends/ABCD1234/matches?slot=1', {
        cookie: me.cookie,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
    ).status,
  ).toBe(409);
  expect(await ctx.db.select().from(ownerTeams)).toHaveLength(2);
});
it('does not allow additional slots to enter official match or opponent routes', async () => {
  const me = await issueGoogleCookie(ctx);
  await member(me.profileId);
  for (const slot of [1, 2]) {
    const r = await callJson(ctx.env, 'GET', `/v1/owner-team/opponents?slot=${slot}`, {
      cookie: me.cookie,
    });
    expect(r.status).toBe(409);
    expect(await r.text()).toContain('PRIMARY_TEAM_ONLY');
    const match = await callJson(ctx.env, 'POST', `/v1/owner-team/matches?slot=${slot}`, {
      cookie: me.cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { opponentTeamId: 'tem_00000000-0000-4000-8000-000000000001' },
    });
    expect(match.status).toBe(409);
    expect(await match.text()).toContain('PRIMARY_TEAM_ONLY');
  }
});
