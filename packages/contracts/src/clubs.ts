import { z } from 'zod';
import { CLUB_CUSTOM_IMG_MAX, CLUB_CUSTOM_IMG_TOTAL_MAX, clubImgTotal } from './club-limits.js';
import { IsoUtcSchema } from './primitives.js';

/**
 * T-10-010. 유저 클럽 커스텀(이름·엠블럼)을 프로필 계정에 저장해 기기 간 동기화한다. 게임 로직과 무관한
 * 표시용 데이터라 통째로(전체 교체) 저장한다. 웹(game/clubs.ts sanitizeClubCustom)과 같은 한도를 쓴다 —
 * 웹은 zod를 번들에 넣지 않으므로 값 검증을 거기서 따로 하고, 여기 숫자와 맞춰 둔다.
 */
export const CLUB_CUSTOM_MAX_CLUBS = 250;
export const CLUB_CUSTOM_NAME_MAX = 20;
export const CLUB_CUSTOM_LOGO_TEXT_MAX = 3;
export { CLUB_CUSTOM_IMG_MAX, CLUB_CUSTOM_IMG_TOTAL_MAX } from './club-limits.js';

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const ClubLogoSchema = z.strictObject({
  text: z.string().max(CLUB_CUSTOM_LOGO_TEXT_MAX * 2),
  bg: HexColorSchema,
  fg: HexColorSchema,
  img: z
    .string()
    .max(CLUB_CUSTOM_IMG_MAX)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});

export const ClubCustomSchema = z.strictObject({
  name: z.string().max(CLUB_CUSTOM_NAME_MAX).optional(),
  logo: ClubLogoSchema.optional(),
});

export const ClubCustomMapSchema = z
  .record(z.string().regex(/^[a-z0-9]{1,6}-\d{1,3}$/), ClubCustomSchema)
  .refine((m) => Object.keys(m).length <= CLUB_CUSTOM_MAX_CLUBS, {
    message: `클럽은 최대 ${CLUB_CUSTOM_MAX_CLUBS}개입니다.`,
  })
  .refine((m) => clubImgTotal(m) <= CLUB_CUSTOM_IMG_TOTAL_MAX, {
    message: '엠블럼 이미지가 너무 많습니다.',
  });

/** PUT /v1/club-custom 본문. updatedAt은 클라이언트가 마지막으로 바꾼 시각(최신 쓰기 우선 판단용). */
export const PutClubCustomBodySchema = z.strictObject({
  clubs: ClubCustomMapSchema,
  updatedAt: IsoUtcSchema,
});

/** GET/PUT 응답. 저장된 적이 없으면 clubs = {}, updatedAt = null. */
export const ClubCustomResponseSchema = z.strictObject({
  clubs: ClubCustomMapSchema,
  updatedAt: IsoUtcSchema.nullable(),
});

export type ClubLogo = z.infer<typeof ClubLogoSchema>;
export type ClubCustom = z.infer<typeof ClubCustomSchema>;
export type ClubCustomMap = z.infer<typeof ClubCustomMapSchema>;
export type PutClubCustomBody = z.infer<typeof PutClubCustomBodySchema>;
export type ClubCustomResponse = z.infer<typeof ClubCustomResponseSchema>;
