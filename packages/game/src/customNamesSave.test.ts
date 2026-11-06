import { afterEach, describe, expect, it } from 'vitest';
import { CONFEDS } from '@offside/contracts/nations';
import { CONT, CUPS, GALA_AWARDS, POTY, SUPERCUP, TOP_SCORER } from './comps.js';
import { LEAGUES } from './data.js';
import { setCustomNames } from './i18n/names.js';
import { playCareer } from './__fixtures__/play-career.js';

// T-11-647: 유저가 바꾼 이름은 화면에서만 쓴다. 게임 진행 중에 만드는 문장(소식 줄 · 이벤트 · 시즌 결산)은 세이브에 남으므로
// 바꾼 이름이 섞이면 안 된다 — 이름표를 걸고 돌린 커리어가 이름표 없이 돌린 커리어와 똑같아야 한다.
const NAMES = [
  ...LEAGUES.map((l) => l.name),
  ...Object.values(CUPS).flat(),
  ...Object.values(SUPERCUP),
  ...Object.values(CONT).map((c) => c.name),
  ...Object.values(CONFEDS).flatMap((c) => [c.cup, c.poty]),
  ...Object.values(TOP_SCORER),
  ...Object.values(POTY),
  ...GALA_AWARDS,
  'FIFA 월드컵', // i18n-ignore 저장값
  'FIFA 클럽 월드컵', // i18n-ignore 저장값
  '아시안게임', // i18n-ignore 저장값
  '올림픽', // i18n-ignore 저장값
];
const MARK = '§바꾼이름';

describe('유저가 바꾼 이름은 세이브에 남지 않는다 (T-11-647)', () => {
  afterEach(() => setCustomNames({}));

  it('이름표를 걸고 돌린 커리어가 이름표 없이 돌린 커리어와 같다', () => {
    for (const seed of [0, 1, 2, 3]) {
      setCustomNames({});
      const plain = JSON.stringify({ ...playCareer(seed), cid: '' });
      setCustomNames(Object.fromEntries(NAMES.map((n, i) => [n, `${MARK}${i}`])));
      const renamed = JSON.stringify({ ...playCareer(seed), cid: '' });
      expect(renamed.includes(MARK), `seed ${seed}`).toBe(false);
      expect(renamed).toBe(plain);
    }
  });
});
