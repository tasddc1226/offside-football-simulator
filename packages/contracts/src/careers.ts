import { z } from 'zod';
import { CommandLogEntrySchema } from './commands.js';
import { IsoUtcSchema } from './primitives.js';
import { CareerSnapshotSchema } from './snapshot.js';
import { SemverSchema } from './versions.js';

const PutCareerSnapshotSchema = CareerSnapshotSchema.omit({ id: true, careerId: true, createdAt: true });
const PutCareerCommandSchema = CommandLogEntrySchema.omit({ careerId: true, createdAt: true });

/** 07 `PUT /careers/{id}` 본문. */
export const PutCareerBodySchema = z
  .object({
    baseRevision: z.number().int().nonnegative(),
    snapshot: PutCareerSnapshotSchema,
    commands: z.array(PutCareerCommandSchema),
    createdServiceSeasonId: z.string().min(1),
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
  })
  .strict()
  .superRefine((body, ctx) => {
    let expectedRevision = body.baseRevision + 1;
    for (let index = 0; index < body.commands.length; index++) {
      const command = body.commands[index]!;
      if (command.revision !== expectedRevision) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `commands[${index}].revision은 ${expectedRevision}이어야 한다. 받은 값: ${command.revision}`,
          path: ['commands', index, 'revision'],
        });
        return;
      }
      expectedRevision += 1;
    }
  });

export type PutCareerBody = z.infer<typeof PutCareerBodySchema>;

export const PutCareerResponseSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    syncedAt: IsoUtcSchema,
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'FAILED']).optional(),
  })
  .strict();

export type PutCareerResponse = z.infer<typeof PutCareerResponseSchema>;

/** API-CAR-001. */
export const CareerSummarySchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(['DRAFT', 'ACTIVE', 'RETIRED', 'ARCHIVED']),
    revision: z.number().int().nonnegative(),
    lastSyncedAt: IsoUtcSchema,
    createdServiceSeasonId: z.string().min(1),
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
  })
  .strict();

export type CareerSummary = z.infer<typeof CareerSummarySchema>;

export const CareerSummaryListSchema = z
  .object({
    items: z.array(CareerSummarySchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export type CareerSummaryList = z.infer<typeof CareerSummaryListSchema>;

/** API-CAR-002. */
export const GetCareerResponseSchema = z
  .object({
    snapshot: CareerSnapshotSchema,
    commands: z.array(CommandLogEntrySchema),
  })
  .strict();

export type GetCareerResponse = z.infer<typeof GetCareerResponseSchema>;

export const RevisionConflictDetailsSchema = z
  .object({
    serverRevision: z.number().int().nonnegative(),
    serverSnapshotUrl: z.string().min(1),
  })
  .strict();

export type RevisionConflictDetails = z.infer<typeof RevisionConflictDetailsSchema>;
