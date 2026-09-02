import { z } from 'zod';
import { checkCommandTypePayload, CommandLogEntrySchema, CommandLogEntryShapeSchema } from './commands.js';
import { ClientIdSchema, IsoUtcSchema } from './primitives.js';
import { CareerSnapshotSchema } from './snapshot.js';
import { SemverSchema } from './versions.js';

const PutCareerSnapshotSchema = CareerSnapshotSchema.omit({ id: true, careerId: true, createdAt: true });
const PutCareerCommandSchema = CommandLogEntryShapeSchema.omit({ careerId: true, createdAt: true }).superRefine(
  checkCommandTypePayload,
);

/** 07 `PUT /careers/{id}` 본문. */
export const PutCareerBodySchema = z
  .strictObject({
    baseRevision: z.number().int().nonnegative(),
    snapshot: PutCareerSnapshotSchema,
    commands: z.array(PutCareerCommandSchema),
    createdServiceSeasonId: z.string().min(1),
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
  })
  .superRefine((body, ctx) => {
    let expectedRevision = body.baseRevision + 1;
    for (let index = 0; index < body.commands.length; index++) {
      const command = body.commands[index]!;
      if (command.revision !== expectedRevision) {
        ctx.addIssue({
          code: 'custom',
          message: `commands[${index}].revision은 ${expectedRevision}이어야 한다. 받은 값: ${command.revision}`,
          path: ['commands', index, 'revision'],
        });
        return;
      }
      expectedRevision += 1;
    }

    // snapshot.revision은 마지막으로 적용된 revision과 같아야 한다: commands가 있으면 그 마지막 항목,
    // 없으면(재확인용 PUT) baseRevision.
    const expectedSnapshotRevision =
      body.commands.length > 0 ? body.commands[body.commands.length - 1]!.revision : body.baseRevision;
    if (body.snapshot.revision !== expectedSnapshotRevision) {
      ctx.addIssue({
        code: 'custom',
        message: `snapshot.revision은 ${expectedSnapshotRevision}이어야 한다. 받은 값: ${body.snapshot.revision}`,
        path: ['snapshot', 'revision'],
      });
    }
  });

export type PutCareerBody = z.infer<typeof PutCareerBodySchema>;

export const PutCareerResponseSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  syncedAt: IsoUtcSchema,
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'FAILED']).optional(),
});

export type PutCareerResponse = z.infer<typeof PutCareerResponseSchema>;

/** API-CAR-001. */
export const CareerSummarySchema = z.strictObject({
  id: ClientIdSchema,
  status: z.enum(['DRAFT', 'ACTIVE', 'RETIRED', 'ARCHIVED']),
  revision: z.number().int().nonnegative(),
  lastSyncedAt: IsoUtcSchema,
  createdServiceSeasonId: z.string().min(1),
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
});

export type CareerSummary = z.infer<typeof CareerSummarySchema>;

export const CareerSummaryListSchema = z.strictObject({
  items: z.array(CareerSummarySchema),
  nextCursor: z.string().nullable(),
});

export type CareerSummaryList = z.infer<typeof CareerSummaryListSchema>;

/** API-CAR-002. */
export const GetCareerResponseSchema = z.strictObject({
  snapshot: CareerSnapshotSchema,
  commands: z.array(CommandLogEntrySchema),
});

export type GetCareerResponse = z.infer<typeof GetCareerResponseSchema>;

export const RevisionConflictDetailsSchema = z.strictObject({
  serverRevision: z.number().int().nonnegative(),
  serverSnapshotUrl: z.string().min(1),
});

export type RevisionConflictDetails = z.infer<typeof RevisionConflictDetailsSchema>;
