import type {
  PlayerDraft as DomainPlayerDraft,
  PlayerProfile as DomainPlayerProfile,
  PositionGroup,
  Position,
  PreferredFoot,
} from '@offside/domain';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  type PlayerDraft,
  PlayerDraftSchema,
  type PlayerPublic,
  PlayerPublicSchema,
  PlayerProfileSchema,
  PositionGroupSchema,
  PositionSchema,
  PreferredFootSchema,
  toPlayerPublic,
} from './player.js';

describe('domain 타입 동일성', () => {
  it('Position', () => {
    expectTypeOf<z.infer<typeof PositionSchema>>().toEqualTypeOf<Position>();
  });

  it('PositionGroup', () => {
    expectTypeOf<z.infer<typeof PositionGroupSchema>>().toEqualTypeOf<PositionGroup>();
  });

  it('PreferredFoot', () => {
    expectTypeOf<z.infer<typeof PreferredFootSchema>>().toEqualTypeOf<PreferredFoot>();
  });

  it('PlayerDraft', () => {
    expectTypeOf<PlayerDraft>().toEqualTypeOf<DomainPlayerDraft>();
  });

  it('PlayerProfile', () => {
    expectTypeOf<z.infer<typeof PlayerProfileSchema>>().toEqualTypeOf<DomainPlayerProfile>();
  });
});

const VALID_PROFILE = {
  name: '김서준',
  nationalityCode: 'KR',
  preferredFoot: 'RIGHT' as const,
  position: 'W' as const,
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
  truePotential: 80,
  scoutedPotentialMin: 72,
  scoutedPotentialMax: 85,
  baseOvr: 59,
};

describe('PlayerDraftSchema', () => {
  it('6개 필드 전부 null을 허용한다', () => {
    const result = PlayerDraftSchema.safeParse({
      name: null,
      nationalityCode: null,
      preferredFoot: null,
      position: null,
      archetypeId: null,
      backgroundId: null,
    });
    expect(result.success).toBe(true);
  });

  it('알 수 없는 필드는 거부한다(strictObject)', () => {
    const result = PlayerDraftSchema.safeParse({
      name: null,
      nationalityCode: null,
      preferredFoot: null,
      position: null,
      archetypeId: null,
      backgroundId: null,
      extra: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('PlayerProfileSchema', () => {
  it('유효한 프로필을 받아들인다', () => {
    expect(PlayerProfileSchema.safeParse(VALID_PROFILE).success).toBe(true);
  });

  it('baseOvr 0은 거부한다', () => {
    expect(PlayerProfileSchema.safeParse({ ...VALID_PROFILE, baseOvr: 0 }).success).toBe(false);
  });

  it('truePotential 39는 거부한다(40 미만)', () => {
    expect(PlayerProfileSchema.safeParse({ ...VALID_PROFILE, truePotential: 39 }).success).toBe(false);
  });
});

describe('toPlayerPublic', () => {
  it('truePotential을 제거하고 나머지 필드는 그대로 둔다', () => {
    const publicProfile: PlayerPublic = toPlayerPublic(VALID_PROFILE);
    expect(publicProfile).not.toHaveProperty('truePotential');
    expect(publicProfile).toEqual({
      name: VALID_PROFILE.name,
      nationalityCode: VALID_PROFILE.nationalityCode,
      preferredFoot: VALID_PROFILE.preferredFoot,
      position: VALID_PROFILE.position,
      archetypeId: VALID_PROFILE.archetypeId,
      backgroundId: VALID_PROFILE.backgroundId,
      scoutedPotentialMin: VALID_PROFILE.scoutedPotentialMin,
      scoutedPotentialMax: VALID_PROFILE.scoutedPotentialMax,
      baseOvr: VALID_PROFILE.baseOvr,
    });
    expect(PlayerPublicSchema.safeParse(publicProfile).success).toBe(true);
  });
});
