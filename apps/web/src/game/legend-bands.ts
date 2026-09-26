// 은퇴 레전드 등급표(T-10-026 칭호의 은퇴 등급). 워커(공유 링크 미리보기)도 읽으므로 게임 코드를 끌어오지 않는
// 작은 모듈로 둔다. 등급 id가 바뀌면 scripts/seo.mjs의 미리보기 이미지(CAREER_OG_BANDS)도 같이 바꾼다.
export type Rarity = 1 | 2 | 3 | 4;

export const LEGEND_BANDS: [id: string, name: string, rarity: Rarity, min: number][] = [
  ['lg_goat', '역대 최고의 전설', 4, 840],
  ['lg_world', '월드클래스 레전드', 4, 590],
  ['lg_club', '클럽 레전드', 3, 425],
  ['lg_pro', '성실한 프로', 2, 305],
  ['lg_plain', '평범한 축구 커리어', 1, 0],
];

/** 은퇴 리포트의 레전드 등급 이름. 칭호의 은퇴 등급과 같은 표를 쓴다. */
export function legendBand(score: number): { id: string; name: string } {
  const b = LEGEND_BANDS.find(([, , , min]) => score >= min)!;
  return { id: b[0], name: b[1] };
}
