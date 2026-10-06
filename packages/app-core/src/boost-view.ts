// T-11-083 선수 탭 '잠재력 강화' 카드(웹·앱 공용). 규칙은 game boost.ts, 여기는 화면 문구만 만든다.
// 잠재력 등급은 은퇴 때 공개하므로 단계(+1~+4)만 보여 준다.
import {
  BOOST,
  BOOST_MAX,
  BOOST_PITY_PCT,
  boostChance,
  boostCost,
  boostState,
  boostStatus,
  tryBoost,
  type BoostStatus,
} from '@offside/game/boost';
import { fmtMoney } from '@offside/game/player';
import type { GameState } from '@offside/game/types';
import { gameBoostText as L } from './i18n/ko/gameBoost';
import { appFormatText as L2 } from './i18n/ko/appFormat.js';

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

/** 안내 문구 — 언어가 정해진 뒤에 읽도록 함수로 둔다. */
export const boostNote = (): string => L.note({ age: BOOST.maxAge, pct: BOOST_PITY_PCT });

/** 카드를 숨길지 — 나이 제한을 넘겼고 한 번도 시도하지 않은 선수에게는 보이지 않는다. */
export const boostHidden = (s: GameState): boolean =>
  boostStatus(s) === 'aged' && !boostState(s).log.length;

export function boostView(s: GameState): BoostView {
  const status = boostStatus(s);
  const b = boostState(s);
  const cost = L2.won({ v: fmtMoney(boostCost(s)) });
  const chance = boostChance(s);
  const line =
    status === 'locked'
      ? L.lineLocked
      : status === 'aged'
        ? L.lineAged({ age: BOOST.maxAge })
        : status === 'max'
          ? L.lineMax({ lv: BOOST_MAX })
          : status === 'done'
            ? L.lineDone
            : status === 'short'
              ? L.lineShort({ cost })
              : L.lineReady({ next: b.lv + 1, chance, cost });
  return {
    status,
    lv: b.lv,
    max: BOOST_MAX,
    line,
    ...(status === 'ready'
      ? {
          button: L.button({ cost, chance }),
          confirm: L.confirm({ cost, chance }),
        }
      : {}),
    note: boostNote(),
    history: b.log
      .slice(-4)
      .reverse()
      .map((x) => {
        const p = { y: x.y, lv: x.lv + 1, pct: x.p, cost: L2.won({ v: fmtMoney(x.c) }) };
        return x.ok ? L.historyOk(p) : L.historyFail(p);
      }),
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
    title: r.ok ? L.resultOkTitle({ lv: r.lv }) : L.resultFailTitle,
    text: r.ok
      ? r.lv >= BOOST_MAX
        ? L.resultOkMax
        : L.resultOk
      : L.resultFail({ chance: r.chance, pct: BOOST_PITY_PCT }),
  };
}
