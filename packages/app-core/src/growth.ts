// ───────── 시즌 성장 기록 (T-11-048, 웹·앱 공용) ─────────
// 시즌 시작·종료 시점의 능력치와 구간별 OVR, 잠재력 평가를 시즌 업로드에 실어 서버가 성장 히스토리를 쌓게 한다.
// 관찰 전용이고 게임 진행에는 쓰이지 않는다 — RNG를 쓰지 않고 상태는 ovrBuf만 건드린다.
import type { SeasonGrowth } from '@offside/contracts';
import { ATTR_KEYS, LAST_PHASE } from '@offside/game/data';
import { SUB_KEYS, mainRole, ovr, ovrRole } from '@offside/game/attributes';
import type { GameState } from '@offside/game/types';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** 구간에 들어갈 때의 OVR을 남긴다. 같은 구간을 다시 불러도(이어하기) 값만 덮어쓴다. */
export function recordPhaseOvr(s: GameState) {
  if (s.phase > LAST_PHASE) return;
  // s가 반응형 프록시(웹 Svelte $state)면 대입한 원본 배열이 아니라 s.ovrBuf(프록시)를 다시 읽어야 한다(pushEvLog와 같다).
  if (!s.ovrBuf) s.ovrBuf = [];
  s.ovrBuf[s.phase] = ovr(s);
}

/**
 * 시즌을 끝내기 *전에* 부른다. endSeason이 노쇠·재평가를 적용하고 시즌 시작 기록을 다음 시즌으로 옮기므로, 그 뒤에는
 * 이 시즌의 끝 값을 읽을 수 없다. 구간 OVR 버퍼는 여기서 비운다. 시즌 시작 기록이 없는 옛 저장은 undefined.
 */
export function takeSeasonGrowth(s: GameState): SeasonGrowth | undefined {
  const buf = s.ovrBuf ?? [];
  s.ovrBuf = [];
  const sub0 = s.seasonStartSub;
  if (!sub0 || !Object.keys(sub0).length || !s.seasonStart) return undefined;
  // 앞에서부터 이어진 구간만 — 중간에 빠진 구간 뒤는 순서를 알 수 없어 버린다.
  const ph: number[] = [];
  for (let i = 0; i <= LAST_PHASE && buf[i] != null; i++) ph.push(buf[i]!);
  return {
    v: 1,
    o0: Math.round(ovrRole({ sub: sub0 }, mainRole(s))),
    ph,
    a0: ATTR_KEYS.map((k) => r1(s.seasonStart[k])),
    a1: ATTR_KEYS.map((k) => r1(s.attrs[k])),
    s0: SUB_KEYS.map((k) => r1(sub0[k] ?? 0)),
    s1: SUB_KEYS.map((k) => r1(s.sub[k] ?? 0)),
    pot: {
      s: s.pot,
      b: s.flags.potBonus ?? 0,
      bl: s.bloom ?? 0,
      r: s.flags.rescout ?? 0,
    },
  };
}
