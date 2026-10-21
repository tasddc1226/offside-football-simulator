// T-11-432 이벤트 선택지 득실. 데이터(event-peek-data.ts)는 __fixtures__/event-peek-build.ts가 만든다 —
// 효과(fx)가 함수라 화면에서는 미리 돌려 보지 않고 생성된 표만 읽는다(게임 결과·RNG와 무관하다).

/** 득실 하나. 'cond+'·'trust-'처럼 항목 + 방향, 이야기 시작은 'story:<키>', 결장은 'out'. */
export type PeekKey = string;
/** ok: 성공(판정 없는 선택지는 그 결과) 때 늘 일어나는 득실, fail: 실패 때. 체감 크기 순서다. */
export type ChoicePeek = { ok?: readonly PeekKey[]; fail?: readonly PeekKey[] };

export type PeekStat = 'cond' | 'morale' | 'fame' | 'trust' | 'money' | 'attr' | 'pot';

/** 선수에게 손해인 득실인지(스캔들 시작 · 결장 · 수치 감소). */
export const peekIsLoss = (k: PeekKey): boolean =>
  k === 'out' || k === 'story:scandal' || k.endsWith('-');
