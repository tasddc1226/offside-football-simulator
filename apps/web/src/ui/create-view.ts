// ───────── 선수 생성 화면 표시 로직 (T-10-022) ─────────
// Create.svelte의 라이브 카드·후보 카드가 쓰는 순수 함수. .svelte.ts 상태를 import하지 않아
// vitest에서 바로 검증할 수 있다.
import { ATTR_KEYS, ATTR_LABEL, GK_LABEL, type AttrKey, type Pos } from '../game/data.js';
import { legacyOvr, RADAR_ORDER } from '../game/attributes.js';

export const POS_BLURB: Record<Pos, string> = {
  FW: '골로 말하는 해결사',
  MF: '패스로 경기를 조율',
  DF: '실점을 막는 벽',
  GK: '마지막 방어선',
};

export const TRAIT_UI: Record<string, { icon: string; short: string }> = {
  early: { icon: '⚡', short: '빨리 크고 일찍 꺾여요' },
  late: { icon: '🌱', short: '늦게 피고 오래 가요' },
  iron: { icon: '🛡️', short: '부상이 크게 줄어요' },
  star: { icon: '⭐', short: '인기·스폰서가 따라와요' },
};

// 가장 높은 능력치 하나로 스카우트가 붙이는 선수 유형 이름.
const ARCHETYPE: Record<Pos, Record<AttrKey, string>> = {
  FW: { sho: '골잡이', pac: '침투형 공격수', dri: '테크니션', phy: '타깃형 공격수', pas: '연계형 공격수', def: '전방 압박형 공격수' },
  MF: { pas: '플레이메이커', dri: '드리블러', def: '홀딩 미드필더', sho: '공격형 미드필더', pac: '박스 투 박스', phy: '박스 투 박스' },
  DF: { def: '스토퍼', phy: '파이터형 수비수', pac: '커버형 수비수', pas: '빌드업 수비수', dri: '볼 플레잉 수비수', sho: '세트피스 헌터' },
  GK: { def: '슈퍼 세이버', pac: '반사 신경형 수문장', phy: '안정형 수문장', pas: '스위퍼 키퍼', dri: '포지셔닝형 키퍼', sho: '스위퍼 키퍼' },
};

export const attrLabels = (pos: Pos): Record<AttrKey, string> => (pos === 'GK' ? GK_LABEL : ATTR_LABEL);

/** 받침이 있으면 '이', 없으면 '가'. */
export function iGa(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 !== 0 ? '이' : '가';
}

/** 시작 OVR 추정치 — newGame이 세부 능력치를 맞추는 목표값(legacyOvr)과 같다. */
export const startOvr = (pos: Pos, attrs: Record<AttrKey, number>): number => Math.round(legacyOvr(pos, attrs));

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

export const radarOrder = (pos: Pos): AttrKey[] => (pos === 'GK' ? RADAR_ORDER.GK : RADAR_ORDER.field);

/** 미니 레이더(육각형) 좌표. radarOrder 순서의 0~100 값을 중심 c, 반지름 r에 매핑한다. */
export function hexPoints(vals: readonly number[], r: number, c = r): string {
  return vals
    .map((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / vals.length;
      return `${(c + (Math.cos(a) * r * v) / 100).toFixed(1)},${(c + (Math.sin(a) * r * v) / 100).toFixed(1)}`;
    })
    .join(' ');
}
