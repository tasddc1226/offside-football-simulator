import { describe, expect, it } from 'vitest';
import { generateCandidates } from '@offside/game/candidates';
import { defaultFocus, typeForFocus, type Pos } from '@offside/game/data';
import { newGame } from '@offside/game/engine';
import { GK_SUBS, ovr, SUBS } from '@offside/game/attributes';
import { BODY_DEFAULT } from '@offside/contracts/body';
import { createRng, setActiveRng } from '@offside/game/rng';
import {
  bodyNote,
  focusNote,
  hiddenStrength,
  ovrFocusView,
  scoutLine,
  seasonStartNote,
  startOvr,
} from './create-view.js';
import { iGa, polyPoints } from './format.js';

describe('선수 생성 표시 로직', () => {
  it('받침에 따라 이/가를 고른다', () => {
    expect(iGa('슈팅')).toBe('이');
    expect(iGa('스피드')).toBe('가');
    expect(iGa('반사 신경')).toBe('이');
  });

  it('스카우트 코멘트는 가장 높은 능력치로 유형을 정한다', () => {
    expect(scoutLine('FW', { pac: 50, sho: 60, pas: 42, dri: 48, def: 28, phy: 46 })).toBe(
      '슈팅이 특출난 골잡이',
    );
    expect(scoutLine('MF', { pac: 46, sho: 42, pas: 55, dri: 54, def: 40, phy: 44 })).toBe(
      '패스·드리블이 고루 좋은 플레이메이커',
    );
    expect(scoutLine('GK', { pac: 48, sho: 30, pas: 38, dri: 40, def: 60, phy: 48 })).toBe(
      '다이빙이 특출난 슈퍼 세이버',
    );
  });

  it('T-11-651 주력을 주면 스카우트 코멘트는 그 주력 조합의 실제 유형 이름을 쓴다', () => {
    const attrs = { pac: 46, sho: 42, pas: 55, dri: 54, def: 40, phy: 44 };
    // 패스가 가장 높아도 드리블 · 피지컬 주력이면 윙어다(라운지 제보: 플메를 노렸는데 윙어).
    expect(scoutLine('MF', attrs, ['dri', 'phy'])).toBe('패스·드리블이 고루 좋은 윙어');
    expect(scoutLine('MF', attrs, ['pas', 'phy'])).toBe('패스·드리블이 고루 좋은 박스 투 박스');
    expect(scoutLine('MF', attrs, [])).toBe('패스·드리블이 고루 좋은 플레이메이커');
  });

  it('T-11-651 주력 고르기 화면은 그 조합으로 정해지는 유형을 보여 준다', () => {
    const winger = ovrFocusView('MF', ['dri', 'phy'], 'DM');
    expect(winger.typeId).toBe(typeForFocus('MF', ['dri', 'phy']));
    expect(winger.typeId).toBe('winger');
    expect(winger.typeLine).toContain('이 조합의 유형: 윙어');
    expect(ovrFocusView('MF', ['pas', 'sho']).typeLine).toContain('플레이메이커');
    expect(ovrFocusView('FW', ['pac', 'dri']).typeLine).toContain('스피드스터');
  });

  it('후보 카드의 시작 OVR은 실제 시작 OVR과 1 이내로 맞는다', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as Pos[]) {
      for (const cand of generateCandidates(pos, defaultFocus(pos))) {
        setActiveRng(createRng(7));
        const g = newGame(
          {
            name: '테스트',
            number: 9,
            pos,
            foot: '오른발',
            focus: defaultFocus(pos),
            trait: 'late',
          },
          7,
          cand.attrs,
        );
        expect(Math.abs(ovr(g) - startOvr(pos, cand.attrs))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('숨은 무기는 주력을 뺀 가장 높은 능력치다', () => {
    expect(
      hiddenStrength({ pac: 56, sho: 58, pas: 39, dri: 48, def: 24, phy: 49 }, ['sho', 'pac']),
    ).toBe('phy');
  });

  it('미니 레이더는 꼭짓점 6개를 만든다', () => {
    const pts = polyPoints([100, 100, 100, 100, 100, 100], 10, 10).split(' ');
    expect(pts).toHaveLength(6);
    expect(pts[0]).toBe('10.0,0.0');
  });
});

describe('bodyNote', () => {
  const names = (note: string) => note.split(' · ').map((p) => p.replace(/ [+−][\d.]+$/, ''));

  it('포지션 평균 체격이면 보정이 없어 빈 문자열이다', () => {
    expect(bodyNote('FW', BODY_DEFAULT.FW)).toBe('');
  });

  it('필드 선수는 골키퍼 능력치를 빼고 큰 보정 4개까지 "이름 +n" 꼴로 보인다', () => {
    const note = bodyNote('FW', { h: 195, w: 95 });
    expect(note).toMatch(/^[^·]+ [+−][\d.]+( · [^·]+ [+−][\d.]+){0,3}$/);
    const gk = GK_SUBS.map((k) => SUBS[k]);
    for (const n of names(note)) expect(gk).not.toContain(n);
  });

  it('골키퍼는 골키퍼에게 쓰이는 체격 보정만 보인다', () => {
    const note = bodyNote('GK', { h: 200, w: 98 });
    const allowed = ['div', 'han', 'jmp', 'str', 'ref', 'rea'].map((k) => SUBS[k]);
    expect(note).not.toBe('');
    for (const n of names(note)) expect(allowed).toContain(n);
  });
});

describe('T-11-437 주력 능력치 버튼 한 줄', () => {
  it('비주력도 훈련 성장이 느려지는 것을 함께 보인다', () => {
    expect(focusNote(true, 6)).toBe('시작 +6 · 성장 +20%');
    expect(focusNote(false, 0)).toBe('시작 변화 없음 · 성장 -10%');
    expect(focusNote(false, -4)).toBe('시작 -4 · 성장 -10%');
  });
});

describe('T-11-654 지금 만들면 어느 시즌 선수인지', () => {
  it('진행 중인 시즌(개막 전이면 프리시즌)을 기록실 · 시즌 업적과 함께 알린다', () => {
    expect(seasonStartNote('2026-10-10T00:00:00.000Z')).toBe(
      '지금 시작하면 시즌 1 선수예요. 은퇴하면 시즌 1 기록실과 구단주 시즌 업적에 들어가요.',
    );
    expect(seasonStartNote('2026-09-30T00:00:00.000Z')).toContain('프리시즌 선수예요');
  });
});
