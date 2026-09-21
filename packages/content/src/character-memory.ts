import { z } from 'zod';
import copy0120 from '../packs/0.12.0/narrative/coach-memory.json' with { type: 'json' };

const template = z
  .string()
  .min(1)
  .refine(
    (value) =>
      [...value.matchAll(/\{([^}]+)\}/g)].every((match) =>
        ['coach', 'season', 'action', 'outcome'].includes(match[1]!),
      ),
    'Unknown coach memory template token',
  );
export const CharacterMemoryCopySchema = z.strictObject({
  rememberedTitle: z.string().min(1),
  followUpTitle: z.string().min(1),
  reunionTitle: z.string().min(1),
  remembered: template,
  followUp: template,
  reunion: template,
  actions: z.strictObject({
    SHOT: z.string(),
    PASS: z.string(),
    BLOCK: z.string(),
    SAVE: z.string(),
  }),
  outcomes: z.strictObject({
    SUCCESS: z.string(),
    NEUTRAL: z.string(),
    FAIL: z.string(),
    FIXED: z.string(),
  }),
});
export type CharacterMemoryCopy = z.infer<typeof CharacterMemoryCopySchema>;
/** Exact pinned version only: legacy stories must never receive new actor attribution. */
export function loadCharacterMemoryCopy(packVersion: string): CharacterMemoryCopy | null {
  return packVersion === '0.12.0' ? CharacterMemoryCopySchema.parse(copy0120) : null;
}
