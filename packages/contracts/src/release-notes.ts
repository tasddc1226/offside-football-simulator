import { z } from 'zod';
import { POST_BODY_MAX } from './board-limits.js';

const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\r\n]+$/);
const noteText = { title: line(100), items: z.array(line(500)).min(1).max(12) };

/** T-11-146 영어·일본어 문구. 게시 이력 해시에는 넣지 않는다(한국어 원문만 고정). */
export const ReleaseNoteTextSchema = z.object(noteText).strict();

/** PR에서 검토한 공개 문구. 배포 때 커밋 메시지를 사용자 공지로 바꾸지 않는다. */
export const ReleaseNoteSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    ...noteText,
    en: ReleaseNoteTextSchema.optional(),
    ja: ReleaseNoteTextSchema.optional(),
    availability: z.enum(['web', 'app', 'web-app', 'web-app-pending']),
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
