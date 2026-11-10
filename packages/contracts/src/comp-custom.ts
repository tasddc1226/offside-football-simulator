import { z } from 'zod';
import {
  COMP_CUSTOM_KEY_MAX,
  COMP_ICON_IMG_MAX,
  COMP_ICON_IMG_PATTERN,
  COMP_ICONS_LIMIT,
  COMP_ICONS_TOTAL_MAX,
  CUSTOM_NAME_MAX,
  CUSTOM_NAMES_LIMIT,
} from './comp-custom-limits.js';
import { IsoUtcSchema } from './primitives.js';

/**
 * T-11-684. 대회 · 수상 이름 바꾸기(T-11-647)와 리그 · 대회 로고(T-11-681)를 프로필 계정에 저장해 기기 간 동기화한다.
 * 구단 꾸미기(clubs.ts)와 같이 표시용 데이터라 통째로(전체 교체) 저장하고 최신 쓰기가 이긴다. 키는 저장된 한국어 이름이다.
 */
const KeySchema = z.string().min(1).max(COMP_CUSTOM_KEY_MAX);

export const CompNameMapSchema = z
  .record(KeySchema, z.string().min(1).max(CUSTOM_NAME_MAX))
  .refine((m) => Object.keys(m).length <= CUSTOM_NAMES_LIMIT);

export const CompIconMapSchema = z
  .record(KeySchema, z.string().max(COMP_ICON_IMG_MAX).regex(COMP_ICON_IMG_PATTERN))
  .refine((m) => Object.keys(m).length <= COMP_ICONS_LIMIT)
  .refine((m) => Object.values(m).reduce((n, v) => n + v.length, 0) <= COMP_ICONS_TOTAL_MAX);

/** PUT /v1/comp-custom 본문. updatedAt은 클라이언트가 마지막으로 바꾼 시각(최신 쓰기 우선 판단용). */
export const PutCompCustomBodySchema = z.strictObject({
  names: CompNameMapSchema,
  icons: CompIconMapSchema,
  updatedAt: IsoUtcSchema,
});

/** GET/PUT 응답. 저장된 적이 없으면 둘 다 {}, updatedAt = null. GET ?since=가 updatedAt과 같으면 둘 다 {}(바뀐 것 없음). */
export const CompCustomResponseSchema = z.strictObject({
  names: CompNameMapSchema,
  icons: CompIconMapSchema,
  updatedAt: IsoUtcSchema.nullable(),
});

export type CompNameMap = z.infer<typeof CompNameMapSchema>;
export type CompIconMap = z.infer<typeof CompIconMapSchema>;
export type PutCompCustomBody = z.infer<typeof PutCompCustomBodySchema>;
export type CompCustomResponse = z.infer<typeof CompCustomResponseSchema>;
