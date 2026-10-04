// ───────── 선수 생성 화면 표시 로직 (T-10-022) ─────────
// Create.svelte의 라이브 카드·후보 카드가 쓰는 순수 함수. .svelte.ts 상태를 import하지 않아
// vitest에서 바로 검증할 수 있다.
import { ATTR_KEYS, attrLabels, type AttrKey, type Pos } from '@offside/game/data';
import { bodyMods, GK_SUBS, legacyOvr, SUBS } from '@offside/game/attributes';
import type { Body } from '@offside/contracts/body';
import { iGa } from './format.js';

// 가장 높은 능력치 하나로 스카우트가 붙이는 선수 유형 이름.
const ARCHETYPE: Record<Pos, Record<AttrKey, string>> = {
  FW: {
    sho: '골잡이',
    pac: '침투형 공격수',
    dri: '테크니션',
    phy: '타깃형 공격수',
    pas: '연계형 공격수',
    def: '전방 압박형 공격수',
  },
  MF: {
    pas: '플레이메이커',
    dri: '드리블러',
    def: '홀딩 미드필더',
    sho: '공격형 미드필더',
    pac: '박스 투 박스',
    phy: '박스 투 박스',
  },
  DF: {
    def: '스토퍼',
    phy: '파이터형 수비수',
    pac: '커버형 수비수',
    pas: '빌드업 수비수',
    dri: '볼 플레잉 수비수',
    sho: '세트피스 헌터',
  },
  GK: {
    def: '슈퍼 세이버',
    pac: '반사 신경형 수문장',
    phy: '안정형 수문장',
    pas: '스위퍼 키퍼',
    dri: '포지셔닝형 키퍼',
    sho: '스위퍼 키퍼',
  },
};

/** 시작 OVR 추정치 — newGame이 세부 능력치를 맞추는 목표값(legacyOvr)과 같다. */
export const startOvr = (pos: Pos, attrs: Record<AttrKey, number>): number =>
  Math.round(legacyOvr(pos, attrs));

/** 한 줄 스카우트 코멘트: 가장 높은 능력치 + 그 능력치로 정한 유형. 1·2위가 거의 같으면 둘 다 말한다. */
export function scoutLine(pos: Pos, attrs: Record<AttrKey, number>): string {
  const [a, b] = ATTR_KEYS.slice().sort((x, y) => attrs[y] - attrs[x]) as [AttrKey, AttrKey];
  const L = attrLabels(pos);
  const kind = ARCHETYPE[pos][a];
  if (attrs[a] - attrs[b] <= 1) return `${L[a]}·${L[b]}${iGa(L[b])} 고루 좋은 ${kind}`;
  return `${L[a]}${iGa(L[a])} 특출난 ${kind}`;
}

/** 주력이 아닌 능력치 중 가장 높은 것 — 주력은 세 후보 모두 비슷해서, 닫힌 카드의 힌트로는 이쪽이 변별력이 있다. */
export function hiddenStrength(attrs: Record<AttrKey, number>, focus: readonly AttrKey[]): AttrKey {
  return ATTR_KEYS.filter((k) => !focus.includes(k)).sort((a, b) => attrs[b] - attrs[a])[0]!;
}

// 골키퍼에게 보여 줄 체격 보정(나머지는 골키퍼 능력치에 거의 안 쓰인다).
const GK_BODY = ['div', 'han', 'jmp', 'str', 'ref', 'rea'];

/** 체격 보정 요약: 포지션에 쓰이는 세부 능력치 중 보정이 큰 4개("민첩성 +2 · 몸싸움 −1"). 보정이 없으면 빈 문자열. */
export function bodyNote(pos: Pos, body: Body): string {
  return Object.entries(bodyMods({ pos, body }))
    .filter(([k]) => (pos === 'GK' ? GK_BODY.includes(k) : !GK_SUBS.includes(k)))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([k, v]) => `${SUBS[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`)
    .join(' · ');
}
