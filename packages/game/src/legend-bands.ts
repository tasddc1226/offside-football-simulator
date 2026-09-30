// 은퇴 레전드 등급표(T-10-026 칭호의 은퇴 등급). 워커(공유 링크 미리보기)도 읽으므로 게임 코드를 끌어오지 않는
// 작은 모듈로 둔다. 등급 id가 바뀌면 scripts/seo.mjs의 미리보기 이미지(CAREER_OG_BANDS)도 같이 바꾼다.
export type Rarity = 1 | 2 | 3 | 4;
type Band = [id: string, name: string, rarity: Rarity, min: number];

/**
 * T-11-018 시즌 1부터 만든 선수의 기준. 프리시즌엔 반복 플레이로 은퇴의 30~40%가 '역대 최고의 전설'이 돼 위쪽
 * 세 등급을 올렸다(성실한 프로·평범은 그대로 — 첫 커리어가 받는 등급은 지금과 같다). 근거:
 * docs/analysis/season1-balance-deepdive-2026-09-30.md
 */
export const LEGEND_BANDS: Band[] = [
  ['lg_goat', '역대 최고의 전설', 4, 1800],
  ['lg_world', '월드클래스 레전드', 4, 1100],
  ['lg_club', '클럽 레전드', 3, 600],
  ['lg_pro', '성실한 프로', 2, 305],
  ['lg_plain', '평범한 축구 커리어', 1, 0],
];
/** 프리시즌 선수(세부 포지션이 없다)의 기준 — 이미 은퇴한 기록의 등급이 바뀌지 않게 그대로 둔다. */
export const LEGEND_BANDS_PRESEASON: Band[] = [
  ['lg_goat', '역대 최고의 전설', 4, 840],
  ['lg_world', '월드클래스 레전드', 4, 590],
  ['lg_club', '클럽 레전드', 3, 425],
  ['lg_pro', '성실한 프로', 2, 305],
  ['lg_plain', '평범한 축구 커리어', 1, 0],
];

/** 그 선수의 등급표. 세부 포지션(T-10-091)은 시즌 1 개막부터 만든 선수에게만 있어 시즌 1 선수를 가른다. */
export const bandsFor = (dpos: string | null | undefined): Band[] =>
  dpos ? LEGEND_BANDS : LEGEND_BANDS_PRESEASON;

/** 은퇴 리포트의 레전드 등급 이름. 칭호의 은퇴 등급과 같은 표를 쓴다. */
export function legendBand(
  score: number,
  dpos: string | null | undefined,
): { id: string; name: string } {
  const b = bandsFor(dpos).find(([, , , min]) => score >= min)!;
  return { id: b[0], name: b[1] };
}
