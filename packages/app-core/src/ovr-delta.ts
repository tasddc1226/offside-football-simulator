// ───────── 선수 헤더의 OVR 변화 표시 (T-11-756, 웹·앱 공용) ─────────
// 시트(이벤트 결과 · 경기 중계 · 결산)가 헤더를 덮는 동안은 숫자를 붙잡아 두고, 헤더가 다시 보일 때 그동안의 변화를
// 한 번에(+3) 알린다. 표시 전용이라 게임 상태 · RNG는 건드리지 않는다.

export type OvrShown = {
  /** 커리어 ID. 다른 커리어를 열면 변화로 치지 않는다. */
  cid: string;
  /** 헤더에 보이는 OVR(정수). */
  n: number;
  /** 마지막으로 알린 변화 폭. 아직 알린 적 없으면 0. */
  delta: number;
  /** 알릴 때마다 1씩 는다(같은 폭이 연달아 나와도 다시 재생하게). */
  seq: number;
};

/** 헤더 변화 표시가 떠 있는 시간(ms). 웹 CSS · 앱 애니메이션 길이와 같다. */
export const OVR_DELTA_MS = 1600;

export function nextOvrShown(
  prev: OvrShown | null,
  cid: string,
  now: number,
  covered: boolean,
): OvrShown {
  if (!prev || prev.cid !== cid) return { cid, n: now, delta: 0, seq: 0 };
  if (covered || now === prev.n) return prev;
  return { cid, n: now, delta: now - prev.n, seq: prev.seq + 1 };
}

/** 변화 폭 글자: +2 · −1. */
export const ovrDeltaText = (d: number): string => (d > 0 ? `+${d}` : `−${Math.abs(d)}`);
