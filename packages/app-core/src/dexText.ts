// T-10-012 확률 도감의 문구 만들기(공통 규칙 · 선택지 확률 표기). 웹 EventDex.svelte와 앱 Dex 화면이 함께 쓴다.
import { EVENT_RULES, JITTER_RANGE } from '@offside/game/engine';
import type { DexChoice } from '@offside/game/eventDex';
import { zoneWidth } from '@offside/game/minigame';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const span = ([lo, hi]: readonly [number, number]) => `${pct(lo)}~${pct(hi)}`;

/** 도감 맨 위 '공통 규칙' — [용어, 설명] 목록(게임 코드의 상수에서 바로 뽑는다). */
export function dexRules(): (readonly [string, string])[] {
  const R = EVENT_RULES;
  const cost = R.safeCost
    .map((c) => `${c.label} −${c.min === c.max ? c.min : `${c.min}~${c.max}`}`)
    .join(' / ');
  return [
    [
      '이벤트가 생길 확률',
      `구간마다 프리시즌 ${pct(R.rate.preseason)}, 전반기·후반기 ${pct(R.rate.season)}. 스토리의 다음 단계는 예정된 때에 따로 찾아와요.`,
    ],
    [
      '같은 이벤트',
      `한 번 나온 이벤트는 최소 ${R.cooldown}구간 동안 다시 나오지 않고, 볼수록 덜 나와요(가중치 1/(1+본 횟수)).`,
    ],
    [
      '성공 판정',
      '선택 창에 뜨는 %가 실제 판정 확률이에요. 0~100 사이 무작위 수가 그보다 작으면 성공 — 숨은 보정은 없어요.',
    ],
    [
      '원터치 미니게임',
      '페널티킥·1대1·승부차기처럼 경기 장면이 있는 선택은 확률 대신 타이밍으로 가려요. 게이지 위를 오가는 바늘을 초록 구간에서 멈추면 성공이고(3초 안에 누르지 않으면 실패), 구간 넓이는 능력치로 정해져요(도감에는 게이지 대비 구간 넓이를 적어요). 감속 모션을 켜 두면 표시된 확률로 판정해요.',
    ],
    [
      '안전한 선택',
      `판정 없이 확정되지만 좋은 효과가 ${span(JITTER_RANGE.safe)}로 줄고, ${pct(R.twist)} 확률로 대가를 치러요(${cost} 중 하나).`,
    ],
    ['결과 수치', `그 밖의 효과는 표시된 크기의 ${span(JITTER_RANGE.normal)} 사이에서 정해져요.`],
    [
      '뜻밖의 반전',
      `대가가 없었다면 ${pct(R.twist)} 확률로 능력치 하나가 바뀌어요. 오를 확률 — 성공·확정 ${pct(R.twistUp.ok)}, 실패 ${pct(R.twistUp.fail)}, 안전한 선택 ${pct(R.twistUp.safe)} (오르면 +1~2, 내리면 −1).`,
    ],
  ];
}

/** 선택지 한 줄의 오른쪽 표기(확률·안전·확정·미니게임 구간 넓이). */
export function oddsText(c: DexChoice): string {
  if (c.kind === 'safe') return '안전';
  if (c.kind === 'sure') return '확정';
  if (c.min === null || c.max === null) return '상황별';
  // T-10-089 미니게임 선택지는 확률이 아니라 성공 구간 넓이다.
  if (c.mg) {
    const mg = c.mg;
    const [lo, hi] = [c.min, c.max].map((v) => Math.round(zoneWidth(v / 100, mg) * 100));
    return `원터치 · 구간 ${lo === hi ? lo : `${lo}~${hi}`}%`;
  }
  return c.min === c.max ? `${c.min}%` : `${c.min}~${c.max}%`;
}
