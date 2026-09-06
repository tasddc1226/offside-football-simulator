import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';
import { SemverSchema } from './versions.js';

/** T-2-012 D-54. `notice`는 서버가 문장을 만들지 않는다(D-12 관례) — 웹이 이 키로 고정 문구를 찾는다. */
export const SERVICE_SEASON_NOTICE_KEYS = ['LINE_TEST'] as const;
export const ServiceSeasonNoticeKeySchema = z.enum(SERVICE_SEASON_NOTICE_KEYS);
export type ServiceSeasonNoticeKey = z.infer<typeof ServiceSeasonNoticeKeySchema>;

/** API-SVC-001. */
export const ServiceSeasonCurrentSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['PRESEASON', 'ACTIVE', 'LOCKED', 'ARCHIVED']),
  isTest: z.boolean(),
  startsAt: IsoUtcSchema,
  endsAt: IsoUtcSchema.nullable(),
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
  notice: ServiceSeasonNoticeKeySchema.nullable(),
});

export type ServiceSeasonCurrent = z.infer<typeof ServiceSeasonCurrentSchema>;
