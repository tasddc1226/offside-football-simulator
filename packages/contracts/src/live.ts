import { z } from 'zod';
import { CareerPosSchema } from './careers.js';

/**
 * T-10-030 홈 라이브 현황. 서버에 실제로 올라온 시즌·은퇴 기록만 담는다(가짜 활동 없음). 진행 중 커리어는
 * 유저가 이름 공개를 켠 경우에만 이름이 있고(T-10-065) careerId는 내보내지 않는다 — 은퇴 기록만 공개 명예의
 * 전당 상세로 이어진다.
 */
export const LiveEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('season'),
    at: z.string(),
    /** T-10-065 공개 이름. 익명이면 null. */
    name: z.string().nullable(),
    pos: CareerPosSchema,
    club: z.string(),
    /** T-10-066 클럽 id. 옛 시즌 기록은 null(배포 전 엣지 캐시 응답엔 없다). */
    clubId: z.string().nullable().optional(),
    league: z.string(),
    apps: z.number().int(),
    goals: z.number().int(),
    assists: z.number().int(),
    cs: z.number().int().nullable(),
    /** 그 시즌 대표 수상(우승·개인상). 없으면 null. */
    honor: z.string().nullable(),
    /** 커리어 첫 시즌(새 선수 등장). */
    first: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('retire'),
    at: z.string(),
    careerId: z.string().min(1),
    name: z.string().nullable(),
    pos: CareerPosSchema,
    number: z.number().int().nullable(),
    score: z.number().int(),
    lastClub: z.string().nullable(),
    lastClubId: z.string().nullable().optional(),
  }),
]);
export type LiveEvent = z.infer<typeof LiveEventSchema>;

/** 오늘(한국 시각 자정부터) 숫자와 지금 뛰는 중(최근 시즌을 올린 진행 중 커리어) 수. */
export const LiveStatsSchema = z.strictObject({
  playing: z.number().int().nonnegative(),
  seasonsToday: z.number().int().nonnegative(),
  newToday: z.number().int().nonnegative(),
  retiredToday: z.number().int().nonnegative(),
});
export type LiveStats = z.infer<typeof LiveStatsSchema>;

/** `GET /v1/live`. feed는 최신순. 최근 1시간이 한산하면 24시간, 그래도 비면 7일까지 넓혀 채운다. */
export const LiveResponseSchema = z.strictObject({
  now: z.string(),
  stats: LiveStatsSchema,
  feed: z.array(LiveEventSchema),
});
export type LiveResponse = z.infer<typeof LiveResponseSchema>;

/** T-10-072 실시간 소켓(`LIVE_SOCKET_PATH`)으로 오는 메시지. event는 피드 한 줄과 같은 모양이다. */
export type LivePush = { type: 'event'; event: LiveEvent };
