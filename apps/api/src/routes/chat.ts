import {
  AdminChatReportListSchema,
  AdminChatReportResolveSchema,
  CHAT_KEEP_MS,
  CHAT_REPORT_HIDE,
  ChatBlockResponseSchema,
  ChatMessageIdSchema,
  ChatMuteInputSchema,
  ChatTicketResponseSchema,
  CommentReportInputSchema,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { getViewer, requireAdmin } from '../auth/admin.js';
import { chatAuthor } from '../chat/rules.js';
import { chatRoom } from '../chat/socket.js';
import { blockAuthor } from '../db/repos/boards.js';
import {
  blockedProfileIds,
  getMutedUntil,
  listOpenChatReports,
  muteChat,
  reportChat,
  reportedMessageIds,
  resolveChatReports,
} from '../db/repos/chat.js';
import { ownerTitlesOf } from '../db/repos/ownerProfile.js';
import { ownerTierOfProfile } from '../db/repos/ownerTiers.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { DAY_MS } from '../time.js';
import { NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-015 실시간 채팅(라운지 방 하나). 누구나 읽고, 계정 로그인 + 닉네임이 있으면 쓴다. 메시지는 채팅방
// Durable Object(chat/room.ts)에 있고 여기선 입장권 발급과 신고·차단(앱스토어 UGC 정책)·운영자 가리기·정지를 한다.
// 서로 다른 CHAT_REPORT_HIDE명이 신고하면 운영자를 기다리지 않고 가린다.

function room(c: Context<AppEnv>) {
  if (!c.env.CHAT)
    throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: '채팅을 잠시 쓸 수 없어요.' });
  return chatRoom(c.env.CHAT);
}

/** 가려지지 않은 메시지. 없으면 404. */
async function findMessage(c: Context<AppEnv>) {
  const id = parseWithAppError(ChatMessageIdSchema, c.req.param('messageId'));
  const chat = room(c);
  const m = await chat.message(id);
  if (!m) throw notFoundError('메시지를 찾을 수 없어요.', 'CHAT_MESSAGE_NOT_FOUND');
  return { chat, m };
}

/** 작성자를 days일 정지하고 그 메시지를 가린다. 열린 소켓은 바로 읽기 전용이 된다. */
async function muteAuthor(
  c: Context<AppEnv>,
  chat: ReturnType<typeof room>,
  input: { profileId: string; messageId: string; days: number },
) {
  const now = Date.now();
  await muteChat(
    getDb(c),
    input.profileId,
    new Date(now + input.days * DAY_MS).toISOString(),
    new Date(now).toISOString(),
  );
  await Promise.all([chat.revoke(input.profileId), chat.hide(input.messageId)]);
}

/** 남의 메시지만 신고·차단한다. 운영자 메시지는 신고·차단하지 않는다. */
async function othersMessage(c: Context<AppEnv>) {
  const found = await findMessage(c);
  const { profileId } = getSessionOrThrow(c);
  if (found.m.profileId === profileId)
    throw new AppError({ code: 'FORBIDDEN', message: '내 메시지는 신고하거나 차단할 수 없어요.' });
  if (found.m.admin)
    throw new AppError({
      code: 'FORBIDDEN',
      message: '운영자 메시지는 신고하거나 차단할 수 없어요.',
    });
  return { ...found, profileId, db: getDb(c) };
}

export function registerChatRoutes(app: Hono<AppEnv>) {
  app.post('/v1/chat/ticket', requireProfile, async (c) => {
    const chat = room(c);
    const { profileId } = getSessionOrThrow(c);
    const db = getDb(c);
    const now = Date.now();
    const [viewer, author, blocked, reported, muted] = await Promise.all([
      getViewer(c),
      chatAuthor(profileId),
      blockedProfileIds(db, profileId).then((ids) => Promise.all(ids.map(chatAuthor))),
      reportedMessageIds(db, profileId, new Date(now - CHAT_KEEP_MS).toISOString()),
      getMutedUntil(db, profileId, new Date(now).toISOString()),
    ]);
    const mutedUntil = viewer.admin ? null : muted;
    const reason = !viewer.google
      ? 'login'
      : !viewer.nickname
        ? 'nickname'
        : mutedUntil
          ? 'muted'
          : null;
    const ticket = reason
      ? null
      : await chat.issueTicket({
          profileId,
          author,
          nickname: viewer.nickname!,
          admin: viewer.admin,
          tier:
            (await ownerTierOfProfile(db, profileId, new Date(now).toISOString()))?.tier ?? null,
          title: (await ownerTitlesOf(db, [profileId])).get(profileId) ?? null,
        });
    return ok(
      c,
      ChatTicketResponseSchema,
      {
        ticket,
        reason,
        author,
        nickname: viewer.nickname,
        admin: viewer.admin,
        mutedUntil,
        blocked,
        reported,
      },
      200,
      NO_STORE,
    );
  });

  app.post('/v1/chat/messages/:messageId/report', requireProfile, async (c) => {
    const { reason } = readBody(c, CommentReportInputSchema);
    const { chat, m, profileId, db } = await othersMessage(c);
    const reports = await reportChat(
      db,
      {
        messageId: m.id,
        profileId,
        reason,
        authorProfileId: m.profileId,
        nickname: m.nickname,
        body: m.body,
      },
      nowIso(),
    );
    if (reports >= CHAT_REPORT_HIDE) await chat.hide(m.id);
    return c.body(null, 204);
  });

  app.post('/v1/chat/messages/:messageId/block', requireProfile, async (c) => {
    const { m, profileId, db } = await othersMessage(c);
    const block = await blockAuthor(
      db,
      { profileId, blockedProfileId: m.profileId, nickname: m.nickname },
      nowIso(),
    );
    return ok(c, ChatBlockResponseSchema, { ...block, author: m.author }, 201);
  });

  app.post('/v1/admin/chat/messages/:messageId/hide', async (c) => {
    await requireAdmin(c);
    const { chat, m } = await findMessage(c);
    await chat.hide(m.id);
    return c.body(null, 204);
  });

  app.post('/v1/admin/chat/messages/:messageId/mute', async (c) => {
    await requireAdmin(c);
    const { days } = readBody(c, ChatMuteInputSchema);
    const { chat, m } = await findMessage(c);
    if (m.admin) throw new AppError({ code: 'FORBIDDEN', message: '운영자는 정지할 수 없어요.' });
    await muteAuthor(c, chat, { profileId: m.profileId, messageId: m.id, days });
    return c.body(null, 204);
  });

  app.get('/v1/admin/chat/reports', async (c) => {
    await requireAdmin(c);
    const items = await listOpenChatReports(getDb(c));
    return ok(c, AdminChatReportListSchema, { items }, 200, NO_STORE);
  });

  /** 신고를 닫는다. 메시지가 이미 방에서 지워졌어도(7일) 사본의 작성자로 정지할 수 있다. */
  app.post('/v1/admin/chat/reports/resolve', async (c) => {
    await requireAdmin(c);
    const input = readBody(c, AdminChatReportResolveSchema);
    const chat = room(c);
    const author = await resolveChatReports(getDb(c), input.messageId, nowIso());
    if (!author) throw notFoundError('열린 신고가 없어요.', 'CHAT_REPORT_NOT_FOUND');
    if (input.action === 'hide') await chat.hide(input.messageId);
    if (input.action === 'mute')
      await muteAuthor(c, chat, {
        profileId: author,
        messageId: input.messageId,
        days: input.days,
      });
    return c.body(null, 204);
  });
}
