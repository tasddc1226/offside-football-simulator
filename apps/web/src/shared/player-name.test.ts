import { loadRuleset } from '@offside/content';
import { describe, expect, it } from 'vitest';
import { PLAYER_NAME_MESSAGES, validatePlayerName } from './player-name.js';

const rules = loadRuleset('1.0.0').draftRules;

describe('validatePlayerName (이슈 158·104)', () => {
  it("허용 문자(한글·영문·숫자·공백·'·-··)로 된 이름은 trim된 값을 돌려준다", () => {
    expect(validatePlayerName(" O'Neil-7 ", rules)).toEqual({ ok: true, value: "O'Neil-7" });
    expect(validatePlayerName('장 폴·리', rules)).toEqual({ ok: true, value: '장 폴·리' });
  });

  it('특수문자만으로 된 이름은 거부한다', () => {
    expect(validatePlayerName('!!!', rules)).toEqual({ ok: false, message: PLAYER_NAME_MESSAGES.disallowedChars });
    expect(validatePlayerName('★★', rules)).toEqual({ ok: false, message: PLAYER_NAME_MESSAGES.disallowedChars });
  });

  it('허용 문자여도 한글·영문 글자가 하나도 없으면 거부한다', () => {
    expect(validatePlayerName("10-'", rules)).toEqual({ ok: false, message: PLAYER_NAME_MESSAGES.letterRequired });
  });

  it('연속 공백은 거부한다', () => {
    expect(validatePlayerName('김  서준', rules)).toEqual({ ok: false, message: PLAYER_NAME_MESSAGES.doubleSpace });
  });

  it('게임 속 등장인물 이름(공백·구분 문자 차이 포함)은 거부한다', () => {
    expect(validatePlayerName('이도현', rules)).toEqual({ ok: false, message: PLAYER_NAME_MESSAGES.reserved });
    expect(validatePlayerName('박 준서', rules)).toEqual({ ok: false, message: PLAYER_NAME_MESSAGES.reserved });
    expect(validatePlayerName('김서준', rules).ok).toBe(true);
  });
});
