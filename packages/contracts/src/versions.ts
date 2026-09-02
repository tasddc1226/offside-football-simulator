import { z } from 'zod';

export const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'semver(x.y.z) 형식이어야 한다.');

/** 05 "버전 정책": schemaVersion·rulesetVersion·contentPackVersion 세 필드. */
export const VersionTripleSchema = z.strictObject({
  schemaVersion: z.literal(1),
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
});

export type VersionTriple = z.infer<typeof VersionTripleSchema>;

/** 05 "버전 정책": clientMinVersion 비교에 쓰는 요청 헤더. */
export const CLIENT_MIN_VERSION_HEADER = 'X-Client-Version';
