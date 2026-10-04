// T-11-083 선수 탭 '잠재력 강화' 카드(웹·앱 공용). 규칙은 game boost.ts, 여기는 화면 문구만 만든다.
// 잠재력 등급은 은퇴 때 공개하므로 단계(+1~+4)만 보여 준다.
import {
  BOOST,
  BOOST_MAX,
  boostChance,
  boostCost,
  boostState,
  boostStatus,
  tryBoost,
  type BoostStatus,
} from '@offside/game/boost';
import { fmtMoney } from '@offside/game/player';
import type { GameState } from '@offside/game/types';

export interface BoostView {
  status: BoostStatus;
  lv: number;
  max: number;
  /** 상태 한 줄. */
  line: string;
  /** 시도할 수 있을 때만 — 비용과 확률을 버튼에 그대로 적는다. */
  button?: string;
  /** 시도 전에 한 번 더 묻는 문구. */
  confirm?: string;
  note: string;
  /** 최근 시도(새것부터 4개). */
  history: string[];
}

export const BOOST_NOTE = `시즌마다 한 번, ${BOOST.maxAge}세까지 시도할 수 있어요. 실패하면 자금만 잃고 다음 확률이 ${Math.round(BOOST.pity * 100)}%p 올라요.`;

/** 카드를 숨길지 — 나이 제한을 넘겼고 한 번도 시도하지 않은 선수에게는 보이지 않는다. */
export const boostHidden = (s: GameState): boolean =>
  boostStatus(s) === 'aged' && !boostState(s).log.length;

export function boostView(s: GameState): BoostView {
  const status = boostStatus(s);
  const b = boostState(s);
  const cost = `${fmtMoney(boostCost(s))}원`;
  const chance = boostChance(s);
  const line =
    status === 'locked'
      ? '첫 시즌을 마치면 강화할 수 있어요.'
      : status === 'aged'
        ? `${BOOST.maxAge}세가 지나 더는 강화할 수 없어요.`
        : status === 'max'
          ? `최고 단계(+${BOOST_MAX})에 닿았어요.`
          : status === 'done'
            ? '이번 시즌엔 이미 시도했어요. 다음 시즌에 다시 할 수 있어요.'
            : status === 'short'
              ? `자금이 모자라요. 다음 단계에 ${cost}이 필요해요.`
              : `다음 단계 +${b.lv + 1} · 성공 확률 ${chance}% · ${cost}`;
  return {
    status,
    lv: b.lv,
    max: BOOST_MAX,
    line,
    ...(status === 'ready'
      ? {
          button: `${cost} 내고 강화하기 (${chance}%)`,
          confirm: `${cost}을 쓰고 ${chance}% 확률로 시도해요. 실패하면 돌려받지 못해요.`,
        }
      : {}),
    note: BOOST_NOTE,
    history: b.log
      .slice(-4)
      .reverse()
      .map(
        (x) => `${x.y} · +${x.lv + 1}단계 ${x.p}% · ${fmtMoney(x.c)}원 · ${x.ok ? '성공' : '실패'}`,
      ),
  };
}

export interface BoostOutcome {
  ok: boolean;
  /** 시도 뒤 단계. */
  lv: number;
  max: number;
  chance: number;
  /** 연출 결과 화면 제목·본문. */
  title: string;
  text: string;
}

/** 시도하고 연출에 쓸 결과를 돌려준다. 시도할 수 없으면 null. 저장은 부르는 쪽이 연출 전에 바로 한다. */
export function doBoost(s: GameState): BoostOutcome | null {
  const r = tryBoost(s);
  if (!r) return null;
  return {
    ok: r.ok,
    lv: r.lv,
    max: BOOST_MAX,
    chance: r.chance,
    title: r.ok ? `+${r.lv}단계 성공` : '강화 실패',
    text: r.ok
      ? r.lv >= BOOST_MAX
        ? '최고 단계에 닿았어요. 성장 한계가 한 뼘 더 올라갔어요.'
        : '성장 한계가 한 뼘 더 올라갔어요.'
      : `성공 확률 ${r.chance}%였어요. 자금은 돌려받지 못하고, 다음 시도 확률이 ${Math.round(BOOST.pity * 100)}%p 올라요.`,
  };
}
