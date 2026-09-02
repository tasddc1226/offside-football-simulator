import { z } from 'zod';
import { SemverSchema } from './pack.ts';

const HEX64_PATTERN = /^[0-9a-f]{64}$/;

export const RulesetManifestSchema = z.strictObject({
  version: SemverSchema,
  checksum: z.string().regex(HEX64_PATTERN, 'checksum은 SHA-256 hex(64자)여야 한다.'),
});

export type RulesetManifest = z.infer<typeof RulesetManifestSchema>;
