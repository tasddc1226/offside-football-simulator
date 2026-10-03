import { z } from 'zod';
import { POST_BODY_MAX } from './board-limits.js';

/** PR에서 검토한 공개 문구. 배포 때 커밋 메시지를 사용자 공지로 바꾸지 않는다. */
export const ReleaseNoteSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    title: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[^\r\n]+$/),
    items: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(500)
          .regex(/^[^\r\n]+$/),
      )
      .min(1)
      .max(12),
    availability: z.enum(['web', 'web-app', 'web-app-pending']),
    appVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .optional(),
  })
  .strict()
  .refine((n) => n.availability !== 'web-app-pending' || !!n.appVersion, {
    message: '앱 업데이트 예정 항목에는 앱 버전이 필요해요.',
  });

export const PublishReleaseNotesSchema = z
  .object({
    sha: z.string().regex(/^[0-9a-f]{40}$/),
    entries: z.array(ReleaseNoteSchema).max(100),
    dryRun: z.boolean().default(false),
  })
  .strict()
  .refine((p) => new Set(p.entries.map((e) => e.id)).size === p.entries.length, {
    message: '릴리즈 항목 ID가 중복됐어요.',
  });

export const PublishedReleaseNotesSchema = z.object({
  postId: z.string().nullable(),
  publishedIds: z.array(z.string()),
  updated: z.boolean(),
  preview: z.string().max(POST_BODY_MAX).optional(),
});

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;
export type PublishReleaseNotes = z.infer<typeof PublishReleaseNotesSchema>;
