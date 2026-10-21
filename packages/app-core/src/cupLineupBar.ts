// T-11-436 편성 화면의 컵 규칙 줄 — 팀 OVR · 구간 상한, 선발 인원 · 최소 인원. 판정은 서버 저장 검사(checkCupLineup)와 같은
// cupLineupVerdict를 쓴다. 서버가 거절할 상태면 block에 이유를 담아 저장을 막고, 거절하지 않는 상태는 경고만 한다.
import type { CupMeResponse, CupResponse } from '@offside/contracts';
import { cupLineupVerdict, divisionFor, type CupLineupRule } from '@offside/contracts/cup';
import { divisionLabel } from './cupDivision.js';
import { cupText as L } from './i18n/ko/cup.js';

export interface CupLineupBar {
  /** entered = 참가 중(서버가 저장을 검사한다), open = 신청할 수 있는 기간(안내만). */
  mode: 'entered' | 'open';
  /** '팀 OVR 80 / 상한 86(시니어)'. 구간이 없는 통합 대회면 null. */
  ovrText: string | null;
  /** '선발 8/최소 8'. */
  filledText: string;
  overCap: boolean;
  short: boolean;
  /** 서버가 저장을 거절하는 이유(있으면 저장을 막는다). */
  block: string | null;
  /** 줄 아래에 보이는 이유(막는 이유 먼저, 그다음 경고). */
  notes: string[];
}

/** 참가 중인 구간 규칙. 'current'로 부른 대회는 마스터일 수 있어 내 구간(me.cupId)의 상한을 구간 목록에서 읽는다(일정 · 최소 인원은 회차 안에서 같다). */
function enteredRule(cup: CupResponse, me: CupMeResponse): CupLineupRule {
  if (!me.cupId || me.cupId === cup.cup.id) return cup.cup;
  const d = cup.divisions?.find((x) => x.id === me.cupId);
  return d ? { ...cup.cup, division: d.division, ovrMax: d.ovrMax } : cup.cup;
}

/** 신청 전: 지금 초안 OVR로 들어갈 수 있는 가장 낮은 구간(상한이 아직 없는 아랫 구간은 건너뛴다). */
function openRule(cup: CupResponse, ovr: number): CupLineupRule {
  const d = cup.divisions?.length ? divisionFor(cup.divisions, ovr) : undefined;
  return d ? { ...cup.cup, division: d.division, ovrMax: d.ovrMax } : cup.cup;
}

/**
 * 컵에 참가 중(탈락 전)이거나 신청을 받는 중이면 줄을 만든다. 그 밖에는 null. 대회 시즌이 편성 중인 시즌과 같은지는
 * 부르는 쪽이 본다.
 */
export function cupLineupBar(
  cup: CupResponse | null,
  me: CupMeResponse | null,
  draft: { ovr: number; filled: number },
  now: string,
): CupLineupBar | null {
  if (!cup || !me) return null;
  const entered = me.entry?.status === 'active';
  if (!entered && cup.phase !== 'open') return null;
  const rule = entered ? enteredRule(cup, me) : openRule(cup, draft.ovr);
  const v = cupLineupVerdict(rule, draft, now);
  const division = divisionLabel(rule.division);
  const ovrText = !division
    ? null
    : rule.division !== 'master' && rule.ovrMax != null
      ? L.barOvrCap({ ovr: draft.ovr, cap: rule.ovrMax, division })
      : L.barOvrNoCap({ ovr: draft.ovr, division });
  const blocks: string[] = [];
  const warns: string[] = [];
  if (entered && v.overCap && division) {
    if (v.capBlocks) blocks.push(L.barOverCapBlock({ division, cap: rule.ovrMax ?? 0 }));
    else warns.push(L.barOverCapMove({ division }));
  }
  if (v.short) {
    if (entered) blocks.push(L.barShortBlock({ min: rule.minFilled }));
    else warns.push(L.barShortEntry({ min: rule.minFilled }));
  }
  return {
    mode: entered ? 'entered' : 'open',
    ovrText,
    filledText: L.barFilled({ n: draft.filled, min: rule.minFilled }),
    // 신청 전에는 초안이 들어갈 구간을 보이므로 상한을 넘는 일이 없다.
    overCap: entered && v.overCap,
    short: v.short,
    block: blocks[0] ?? null,
    notes: [...blocks, ...warns],
  };
}
