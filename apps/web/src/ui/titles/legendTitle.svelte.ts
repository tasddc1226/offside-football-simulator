// 은퇴한 내 선수의 대표 칭호. 이번 접속에서 고른 값(TitlePickCard, 지연 로드)을 열려 있는 은퇴 화면이 바로 다시 그린다.

/** 커리어 id → 이번 접속에서 고른 대표 칭호. */
export const picked = $state<Record<string, string | null>>({});

/** 이 선수의 대표 칭호 — 이번 접속에서 고른 값이 먼저, 없으면 저장된 값. */
export const legendTitleOf = (careerId: string | undefined, saved: string | null | undefined) =>
  careerId && careerId in picked ? picked[careerId] : saved;
