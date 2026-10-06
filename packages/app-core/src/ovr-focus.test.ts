import { describe, expect, it } from 'vitest';
import { DETAILS_OF, DPOS, defaultFocus, type Pos } from '@offside/game/data';
import { mainRole, ROLES, FACE } from '@offside/game/attributes';
import { newGame } from '@offside/game/engine';
import { trainingHelp, TRAININGS } from '@offside/game/training';
import { ovrFocusView } from './create-view';

describe('role-based OVR guidance', () => {
  it('explains that striker Defense contributes through heading', () => {
    const v = ovrFocusView('FW', ['sho', 'dri'], 'ST');
    expect(v.keys).toEqual(['sho', 'dri', 'def']);
    expect(v.groups).toContain('수비(헤딩)');
    expect(v.subs).toContain('헤딩 정확도');
    expect(v.note).toContain('헤딩 정확도만');
  });
  it('distinguishes winger and keeper groups', () => {
    expect(ovrFocusView('FW', [], 'W').keys).toEqual(['dri', 'pas', 'sho']);
    const gk = ovrFocusView('GK', [], 'GK');
    expect(gk.groups).not.toMatch(/수비|슈팅/);
    expect(gk.subs).toContain('다이빙');
  });
  it('follows actual mainRole for every detail and legacy focus, without mutating inputs', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as Pos[]) {
      for (const dpos of [...DETAILS_OF[pos], undefined]) {
        const focus = dpos ? [...DPOS[dpos].focus] : defaultFocus(pos);
        const before = [...focus];
        const s = newGame(
          {
            name: 'QA',
            trait: 'late',
            number: 9,
            foot: '오른발',
            pos,
            focus,
            ...(dpos ? { dpos } : {}),
          },
          7,
        );
        const v = ovrFocusView(pos, focus, dpos);
        expect(v.role).toBe(mainRole(s));
        expect(focus).toEqual(before);
        expect(v.keys).toHaveLength(3);
        expect(
          v.keys.every((k) => Object.keys(FACE[k]).some((sub) => (ROLES[v.role]![sub] ?? 0) > 0)) ||
            pos === 'GK',
        ).toBe(true);
      }
    }
  });
  it('selected defense training explains actual heading contribution, not tackling', () => {
    const s = newGame(
      {
        name: 'QA',
        trait: 'late',
        number: 9,
        foot: '오른발',
        pos: 'FW',
        dpos: 'ST',
        focus: ['sho', 'dri'],
      },
      7,
    );
    const help = trainingHelp(
      s,
      TRAININGS.find((t) => t.attr === 'def')!,
    );
    expect(help).toContain('헤딩 정확도');
    expect(help).not.toMatch(/스탠딩 태클|수비 인식/);
    const pass = trainingHelp(
      s,
      TRAININGS.find((t) => t.attr === 'pas')!,
    );
    expect(pass).toContain('경기에서의 활용은 달라요');
  });
});
