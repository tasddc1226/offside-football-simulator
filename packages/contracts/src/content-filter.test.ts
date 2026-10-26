import { describe, expect, it } from 'vitest';
import { PUBLIC_NAME_CHARS, toPublicName } from './content-filter.js';
import { NicknameSchema } from './profile.js';
import { ManagerNameSchema, TeamNameSchema } from './teams.js';

describe('보이지 않는 이름 (T-11-462)', () => {
  const invisible = ['ㅤㅤ', 'ᅟᅠ', 'ﾠﾠ', '​​', '⠀⠀', 'ㅤ ‍'];
  it('보이는 글자가 없으면 공개 이름 · 닉네임 · 팀 이름 · 감독 이름 모두 거절한다', () => {
    for (const name of invisible) {
      expect(PUBLIC_NAME_CHARS.test(name)).toBe(false);
      expect(toPublicName(name)).toBeNull();
      expect(NicknameSchema.safeParse(name).success).toBe(false);
      expect(TeamNameSchema.safeParse(name).success).toBe(false);
      expect(ManagerNameSchema.safeParse(name).success).toBe(false);
    }
  });
  it('보이는 글자가 하나라도 있으면 받는다', () => {
    for (const name of ['ㅤ가', '손흥민', 'Son 7', 'ㅋㅋ'])
      expect(PUBLIC_NAME_CHARS.test(name)).toBe(true);
    expect(NicknameSchema.parse('하이픈')).toBe('하이픈');
  });
});
