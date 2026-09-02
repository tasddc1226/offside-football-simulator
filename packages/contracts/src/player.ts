import type { PlayerProfile } from '@offside/domain';
import { z } from 'zod';

// D-1: 포지션 8종과 묶음. domain positionGroupOf의 매핑과 같은 값을 쓴다(CB·FB → DEF, DM·CM·AM →
// MID, W·ST → FWD). 런타임 목록은 domain에서 import하지 않는다(ADR-005, contracts → domain은 타입만).
export const PositionSchema = z.enum(['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST']);

export const PositionGroupSchema = z.enum(['GK', 'DEF', 'MID', 'FWD']);

export const PreferredFootSchema = z.enum(['LEFT', 'RIGHT', 'BOTH']);

/**
 * DRAFT 단계 입력. 6개 필드 전부 nullable(채워지지 않은 값은 null). 이름 길이·국적·아키타입 같은
 * 룰셋 의존 검증은 여기서 하지 않는다(contracts는 룰셋을 모른다) — domain `simulate`가 룰셋으로 검사한다.
 */
export const PlayerDraftSchema = z.strictObject({
  name: z.string().nullable(),
  nationalityCode: z.string().nullable(),
  preferredFoot: PreferredFootSchema.nullable(),
  position: PositionSchema.nullable(),
  archetypeId: z.string().nullable(),
  backgroundId: z.string().nullable(),
});

export type PlayerDraft = z.infer<typeof PlayerDraftSchema>;

/**
 * CONFIRM_PLAYER가 확정하는 선수 정체성·잠재력·Base OVR 전체(D-6). `truePotential`을 포함하므로
 * Snapshot `state` 내부 검증에만 쓴다 — 화면·API 응답은 이 필드가 없는 `PlayerPublic`만 쓴다.
 */
export const PlayerProfileSchema = z.strictObject({
  name: z.string(),
  nationalityCode: z.string(),
  preferredFoot: PreferredFootSchema,
  position: PositionSchema,
  archetypeId: z.string(),
  backgroundId: z.string(),
  truePotential: z.number().int().min(40).max(99),
  scoutedPotentialMin: z.number().int().min(40).max(99),
  scoutedPotentialMax: z.number().int().min(40).max(99),
  baseOvr: z.number().int().min(1).max(99),
});

/**
 * D-6: 화면·API 응답에 노출하는 선수 형태. `truePotential`은 상태·해시에는 남지만 화면·로그·에러
 * details 어디에도 노출하지 않는다 — 이 타입은 그 필드를 아예 갖지 않는다.
 */
export const PlayerPublicSchema = PlayerProfileSchema.omit({ truePotential: true });
export type PlayerPublic = z.infer<typeof PlayerPublicSchema>;

/**
 * `PlayerProfile` → `PlayerPublic`. `truePotential`을 절대 넘기지 않도록 제외 대신 허용 목록으로
 * 필드를 나열한다(D-6).
 */
export function toPlayerPublic(profile: PlayerProfile): PlayerPublic {
  return {
    name: profile.name,
    nationalityCode: profile.nationalityCode,
    preferredFoot: profile.preferredFoot,
    position: profile.position,
    archetypeId: profile.archetypeId,
    backgroundId: profile.backgroundId,
    scoutedPotentialMin: profile.scoutedPotentialMin,
    scoutedPotentialMax: profile.scoutedPotentialMax,
    baseOvr: profile.baseOvr,
  };
}
