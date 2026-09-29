import { z } from 'zod';
import { CareerPosSchema } from './careers.js';

// T-10-122 홈 전광판(헤더와 첫 카드 사이를 흐르는 한 줄 소식). 라이브 현황(T-10-030)이 시즌·은퇴를 그대로 보여
// 준다면, 전광판은 그 사이에서 눈길을 끄는 것만 고른다 — 구단이 바뀐 시즌(이적·프로 입단)과 서버 최초 기록·
// 신기록. 서버에 실제로 올라온 기록만 담고(가짜 소식 없음), 이름은 유저가 이름 공개를 켠 경우에만 있다.

const holder = {
  /** 공개 이름. 익명이면 null. */
  name: z.string().nullable(),
  pos: CareerPosSchema,
  /** 등번호(은퇴 기록에만 있다). */
  number: z.number().int().nullable(),
};

/** 직전 시즌과 소속이 바뀐 시즌 하나. 클럽은 게임 클럽 id만 — 이름은 웹이 id로 찾는다(유저가 바꿔 부른 이름을
 * 다른 유저에게 퍼뜨리지 않는다). 병역 시즌과 id 없는 옛 기록은 빠진다. */
export const TickerTransferSchema = z.strictObject({
  at: z.string(),
  ...holder,
  /** 새 소속에서 뛴 시즌의 나이. */
  age: z.number().int(),
  fromClubId: z.string(),
  toClubId: z.string(),
});
export type TickerTransfer = z.infer<typeof TickerTransferSchema>;

/** 서버 최초 기록(first)·서버 신기록(record) 하나. record만 value·unit이 있다. */
export const TickerFirstSchema = z.strictObject({
  at: z.string(),
  kind: z.enum(['first', 'record']),
  id: z.string(),
  label: z.string(),
  value: z.number().int().nullable(),
  unit: z.string().nullable(),
  ...holder,
});
export type TickerFirst = z.infer<typeof TickerFirstSchema>;

/** `GET /v1/ticker`. 두 목록 모두 최신순 — 섞는 건 웹이 한다. */
export const TickerResponseSchema = z.strictObject({
  now: z.string(),
  transfers: z.array(TickerTransferSchema),
  firsts: z.array(TickerFirstSchema),
});
export type TickerResponse = z.infer<typeof TickerResponseSchema>;
