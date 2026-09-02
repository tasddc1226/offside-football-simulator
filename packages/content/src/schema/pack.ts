import { z } from 'zod';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;

export const SemverSchema = z.string().regex(SEMVER_PATTERN, '안정 버전(semver, 프리릴리스 금지)만 허용한다.');

export const PackManifestSchema = z
  .strictObject({
    contentPackVersion: SemverSchema,
    compatibleRulesetVersions: z.array(SemverSchema).min(1),
    clientMinVersion: SemverSchema,
    playtested: z.boolean(),
    checksum: z.string().regex(HEX64_PATTERN, 'checksum은 SHA-256 hex(64자)여야 한다.'),
    files: z.array(z.string().min(1)),
  })
  .superRefine((manifest, ctx) => {
    const sorted = [...manifest.files].sort();
    const isSorted = manifest.files.every((file, index) => file === sorted[index]);
    if (!isSorted) {
      ctx.addIssue({ code: 'custom', message: 'files는 정렬된 순서여야 한다.', path: ['files'] });
    }
  });

export type PackManifest = z.infer<typeof PackManifestSchema>;
