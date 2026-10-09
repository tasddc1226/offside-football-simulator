import { CHAT_REPORT_HIDE, CHAT_SOCKET_PATH, type ChatServerEvent } from '@offside/contracts/chat';
import type { AdminChatReport, ChatTicketResponse } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatReports } from '../db/schema.js';
import worker from '../index.js';
import { fakeRoom, type FakeSocket } from '../test/chatRoom.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  callJson,
  deleteProfile,
  issueAdminCookie,
  issueCookie,
  issueGoogleCookie,
  ORIGIN,
} from '../test/http.js';

describe('T-11-015 채팅 /v1/chat', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  let chat: ReturnType<typeof fakeRoom>;
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);
  const ticketOf = async (cookie: string) => {
    const res = await call('POST', '/v1/chat/ticket', { cookie });
    return { status: res.status, data: ((await res.json()) as { data: ChatTicketResponse }).data };
  };
  /** 닉네임까지 정한 계정으로 방에 들어가 한 줄 쓰고, 그 소켓과 메시지 id를 돌려준다. */
  async function speak(nickname: string, body = '안녕하세요') {
    const who = await issueGoogleCookie(ctx, { nickname });
    const ws = await chat.join((await ticketOf(who.cookie)).data.ticket!);
    chat.room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: 'send', body }));
    const id = (ws.sent.at(-1) as { m: { id: string } }).m.id;
    return { ...who, ws, id };
  }
  const last = (ws: FakeSocket) => ws.sent.at(-1) as ChatServerEvent;

  beforeEach(async () => {
    ctx = await createTestD1();
    chat = fakeRoom();
    env = { ...ctx.env, CHAT: chat.ns, ADMIN_EMAILS: ADMIN_EMAIL };
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx.dispose();
  });

  it('입장권은 계정 로그인과 닉네임이 있어야 받고, 못 받으면 이유를 알려 준다', async () => {
    expect((await call('POST', '/v1/chat/ticket')).status).toBe(401);
    const anon = await ticketOf((await issueCookie(ctx)).cookie);
    expect(anon).toMatchObject({ status: 200, data: { ticket: null, reason: 'login' } });
    const noName = await ticketOf((await issueGoogleCookie(ctx, { nickname: null })).cookie);
    expect(noName.data).toMatchObject({ ticket: null, reason: 'nickname' });

    const ok = await ticketOf((await issueGoogleCookie(ctx, { nickname: '도하람' })).cookie);
    expect(ok.data).toMatchObject({
      reason: null,
      nickname: '도하람',
      admin: false,
      blocked: [],
      reported: [],
    });
    expect((await chat.join(ok.data.ticket!)).sent[0]).toMatchObject({ t: 'hello', write: true });

    delete env.CHAT;
    expect(
      (await call('POST', '/v1/chat/ticket', { cookie: (await issueCookie(ctx)).cookie })).status,
    ).toBe(503);
  });

  it('서로 다른 사람의 신고가 쌓이면 가리고, 내 메시지는 신고하지 못한다', async () => {
    const bob = await speak('밥');
    const report = (cookie: string, id = bob.id) =>
      call('POST', `/v1/chat/messages/${id}/report`, { cookie, body: { reason: 'abuse' } });
    expect((await report(bob.cookie)).status).toBe(403);
    expect((await report(bob.cookie, 'nope')).status).toBe(400);
    expect((await report(bob.cookie, crypto.randomUUID())).status).toBe(404);

    const reporters = await Promise.all(
      Array.from({ length: CHAT_REPORT_HIDE }, () => issueCookie(ctx)),
    );
    for (const r of reporters.slice(0, -1)) {
      expect((await report(r.cookie)).status).toBe(204);
      expect((await report(r.cookie)).status).toBe(204); // 같은 사람은 한 번만 센다
    }
    expect(chat.room.message(bob.id)).not.toBeNull();
    expect((await report(reporters.at(-1)!.cookie)).status).toBe(204);
    expect(chat.room.message(bob.id)).toBeNull();
    expect(last(bob.ws)).toEqual({ t: 'hide', id: bob.id });
    expect(await ctx.db.select().from(chatReports)).toHaveLength(CHAT_REPORT_HIDE);
    // 신고한 사람은 다음 입장권에서 그 메시지를 빼라고 받는다(게시판 댓글처럼).
    expect((await ticketOf(reporters[0]!.cookie)).data.reported).toEqual([bob.id]);
    expect((await ctx.db.select().from(chatReports))[0]).toMatchObject({
      authorProfileId: bob.profileId,
      nickname: '밥',
      body: '안녕하세요',
    });
  });

  it('차단하면 작성자 키를 돌려주고 다음 입장권의 차단 목록에 든다. 운영자는 차단하지 않는다', async () => {
    const bob = await speak('밥');
    const alice = await issueGoogleCookie(ctx, { nickname: '앨리스' });
    const res = await call('POST', `/v1/chat/messages/${bob.id}/block`, { cookie: alice.cookie });
    expect(res.status).toBe(201);
    const { author } = ((await res.json()) as { data: { author: string } }).data;
    expect((await ticketOf(alice.cookie)).data.blocked).toEqual([author]);
    expect((await ticketOf(bob.cookie)).data.author).toBe(author);

    // T-11-167 채팅에서 차단 목록을 보고 게시판과 같은 경로로 푼다.
    const list = await call('GET', '/v1/chat/blocks', { cookie: alice.cookie });
    expect(list.status).toBe(200);
    const { blocks } = (
      (await list.json()) as {
        data: { blocks: { id: string; nickname: string; author: string }[] };
      }
    ).data;
    expect(blocks).toEqual([expect.objectContaining({ nickname: '밥', author })]);
    expect((await call('GET', '/v1/chat/blocks')).status).toBe(401);
    expect(
      (await call('DELETE', `/v1/boards/blocks/${blocks[0]!.id}`, { cookie: alice.cookie })).status,
    ).toBe(204);
    expect((await ticketOf(alice.cookie)).data.blocked).toEqual([]);
    await call('POST', `/v1/chat/messages/${bob.id}/block`, { cookie: alice.cookie });

    const admin = await issueAdminCookie(ctx);
    const ws = await chat.join((await ticketOf(admin.cookie)).data.ticket!);
    chat.room.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ t: 'send', body: '공지' }),
    );
    const notice = (last(ws) as { m: { id: string; nickname: string } }).m;
    expect(notice.nickname).toBe('운영자');
    expect(
      (await call('POST', `/v1/chat/messages/${notice.id}/block`, { cookie: alice.cookie })).status,
    ).toBe(403);
  });

  it('운영자는 가리고 정지한다 — 정지된 사람은 바로 읽기 전용, 입장권도 못 받는다', async () => {
    const bob = await speak('밥');
    const other = await speak('앨리스', '반가워요');
    const admin = await issueAdminCookie(ctx);
    const mute = (cookie: string, id = bob.id) =>
      call('POST', `/v1/admin/chat/messages/${id}/mute`, { cookie, body: { days: 7 } });
    expect((await mute(other.cookie)).status).toBe(403);
    expect(
      (await call('POST', `/v1/admin/chat/messages/${other.id}/hide`, { cookie: bob.cookie }))
        .status,
    ).toBe(403);

    expect((await mute(admin.cookie)).status).toBe(204);
    expect(bob.ws.sent.slice(-2)).toEqual(
      expect.arrayContaining([
        { t: 'err', code: 'muted' },
        { t: 'hide', id: bob.id },
      ]),
    );
    const again = await ticketOf(bob.cookie);
    expect(again.data).toMatchObject({ ticket: null, reason: 'muted' });
    expect(Date.parse(again.data.mutedUntil!)).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    expect(
      (await call('POST', `/v1/admin/chat/messages/${other.id}/hide`, { cookie: admin.cookie }))
        .status,
    ).toBe(204);
    expect(chat.room.message(other.id)).toBeNull();
  });

  it('운영자는 열린 신고를 메시지마다 모아 보고, 가리거나 기각하거나 작성자를 정지한다', async () => {
    const bob = await speak('밥', '나쁜 말');
    const carol = await speak('캐럴', '광고');
    const dave = await speak('데이브', '그냥 말');
    const admin = await issueAdminCookie(ctx);
    const [r1, r2] = await Promise.all([issueCookie(ctx), issueCookie(ctx)]);
    const report = (cookie: string, id: string, reason: string) =>
      call('POST', `/v1/chat/messages/${id}/report`, { cookie, body: { reason } });
    await report(r1.cookie, bob.id, 'abuse');
    await report(r2.cookie, bob.id, 'spam');
    await report(r1.cookie, carol.id, 'spam');
    await report(r1.cookie, dave.id, 'other');

    const list = async (cookie = admin.cookie) => {
      const res = await call('GET', '/v1/admin/chat/reports', { cookie });
      return {
        status: res.status,
        items: ((await res.json()) as { data?: { items: AdminChatReport[] } }).data?.items,
      };
    };
    expect((await list(bob.cookie)).status).toBe(403);
    const open = (await list()).items!;
    expect(open.map((i) => i.messageId).sort()).toEqual([bob.id, carol.id, dave.id].sort());
    expect(open.find((i) => i.messageId === bob.id)).toMatchObject({
      nickname: '밥',
      body: '나쁜 말',
      reports: 2,
    });
    expect(open.find((i) => i.messageId === bob.id)!.reasons.sort()).toEqual(['abuse', 'spam']);

    const resolve = (body: Record<string, unknown>) =>
      call('POST', '/v1/admin/chat/reports/resolve', { cookie: admin.cookie, body });
    expect((await resolve({ messageId: dave.id, action: 'dismiss' })).status).toBe(204);
    expect(chat.room.message(dave.id)).not.toBeNull();
    expect((await resolve({ messageId: dave.id, action: 'dismiss' })).status).toBe(404);
    expect((await resolve({ messageId: carol.id, action: 'hide' })).status).toBe(204);
    expect(chat.room.message(carol.id)).toBeNull();
    expect((await resolve({ messageId: bob.id, action: 'mute' })).status).toBe(400); // 기간 없음
    expect((await resolve({ messageId: bob.id, action: 'mute', days: 30 })).status).toBe(204);
    expect(chat.room.message(bob.id)).toBeNull();
    expect((await ticketOf(bob.cookie)).data.reason).toBe('muted');
    expect((await list()).items).toEqual([]);
  });

  it('프로필을 지우면 그 사람의 신고 사본·정지 기록도 지운다', async () => {
    const bob = await speak('밥');
    const alice = await issueCookie(ctx);
    await call('POST', `/v1/chat/messages/${bob.id}/report`, {
      cookie: alice.cookie,
      body: { reason: 'spam' },
    });
    expect((await deleteProfile(env, bob.cookie, 'chat-del')).ok).toBe(true);
    expect(await ctx.db.select().from(chatReports)).toHaveLength(0);
  });

  it('소켓 업그레이드는 앱 미들웨어를 거치지 않고 채팅방으로 넘긴다', async () => {
    const res = await worker.fetch(
      new Request(`http://api.test${CHAT_SOCKET_PATH}`, {
        headers: { Upgrade: 'websocket', Origin: ORIGIN },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(res.ok).toBe(true);
    expect(chat.sockets).toHaveLength(1);
    const evil = await worker.fetch(
      new Request(`http://api.test${CHAT_SOCKET_PATH}`, {
        headers: { Upgrade: 'websocket', Origin: 'https://evil.example' },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(evil.status).toBe(403);
  });
});
