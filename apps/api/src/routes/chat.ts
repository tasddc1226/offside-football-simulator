import {
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
  muteChat,
  reportChat,
  reportedMessageIds,
} from '../db/repos/chat.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-015 실시간 채팅(라운지 방 하나). 누구나 읽고, 계정 로그인 + 닉네임이 있으면 쓴다. 메시지는 채팅방
// Durable Object(chat/room.ts)에 있고 여기선 입장권 발급과 신고·차단(앱스토어 UGC 정책)·운영자 가리기·정지를 한다.
// 서로 다른 CHAT_REPORT_HIDE명이 신고하면 운영자를 기다리지 않고 가린다.

const DAY_MS = 24 * 60 * 60 * 1000;

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

/** 남의 메시지만 신고·차단한다. */
async function othersMessage(c: Context<AppEnv>) {
  const found = await findMessage(c);
  const { profileId } = getSessionOrThrow(c);
  if (found.m.profileId === profileId)
    throw new AppError({ code: 'FORBIDDEN', message: '내 메시지는 신고하거나 차단할 수 없어요.' });
  return { ...found, profileId, db: getDb(c) };
}

export function registerChatRoutes(app: Hono<AppEnv>) {
  app.post('/v1/chat/ticket', requireProfile, async (c) => {
    const chat = room(c);
    const viewer = await getViewer(c);
    const profileId = viewer.profileId!;
    const db = getDb(c);
    const now = Date.now();
    const [author, blocked, reported, mutedUntil] = await Promise.all([
      chatAuthor(profileId),
      blockedProfileIds(db, profileId).then((ids) => Promise.all(ids.map(chatAuthor))),
      reportedMessageIds(db, profileId, new Date(now - CHAT_KEEP_MS).toISOString()),
      viewer.admin ? null : getMutedUntil(db, profileId, new Date(now).toISOString()),
    ]);
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
    if (m.admin) throw new AppError({ code: 'FORBIDDEN', message: '운영자는 차단할 수 없어요.' });
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

  /** 작성자를 정지하고 그 메시지를 가린다. 열린 소켓은 바로 읽기 전용이 된다. */
  app.post('/v1/admin/chat/messages/:messageId/mute', async (c) => {
    await requireAdmin(c);
    const { days } = readBody(c, ChatMuteInputSchema);
    const { chat, m } = await findMessage(c);
    if (m.admin) throw new AppError({ code: 'FORBIDDEN', message: '운영자는 정지할 수 없어요.' });
    const now = Date.now();
    await muteChat(
      getDb(c),
      m.profileId,
      new Date(now + days * DAY_MS).toISOString(),
      new Date(now).toISOString(),
    );
    await Promise.all([chat.revoke(m.profileId), chat.hide(m.id)]);
    return c.body(null, 204);
  });
}
