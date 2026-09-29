import { BOARD_KEYS, BOARD_PAGE_LIMIT } from '@offside/contracts/board-limits';

// T-10-047. 엣지에 담는 공개 조회의 경로(= 캐시 키)와, 쓰기가 낡게 만드는 키를 한곳에 둔다.
// 새 조회를 엣지에 담으면 EDGE에 키를 더하고, 그 데이터를 바꾸는 쓰기를 STALE에 적는다. 와일드카드 퍼지는
// 없다 — 지울 키를 정확히 알 수 없는 조회(명예의 전당 목록처럼 쿼리가 여러 가지)는 TTL로만 새로 읽는다.

export const EDGE = {
  balance: '/v1/balance',
  adminStats: '/v1/admin/stats',
  firsts: '/v1/firsts',
  retiredNumbers: '/v1/retired-numbers',
  live: '/v1/live',
  hofDetail: (careerId: string) => `/v1/hof/${careerId}`,
  hofList: (limit: number, page: number, sort: string, season?: number) =>
    `/v1/hof?limit=${limit}&page=${page}&sort=${sort}${season ? `&season=${season}` : ''}`,
  /** T-10-092 라이브 랭킹(팀 랭킹). TTL로만 새로 읽는다(원작처럼 5분마다 갱신). */
  teamRank: (season: number, sort: string, page: number) =>
    `/v1/teams?season=${season}&sort=${sort}&page=${page}`,
  /** 게시판 목록은 첫 페이지(웹 기본 limit)만 담는다. */
  boardFirstPage: (board: string) => `/v1/boards/${board}/posts?limit=${BOARD_PAGE_LIMIT}`,
} as const;

const allBoardLists = () => BOARD_KEYS.map(EDGE.boardFirstPage);

/** 쓰기 → 지울 엣지 키. */
export const STALE = {
  balanceActivated: () => [EDGE.balance],
  firstsChanged: () => [EDGE.firsts],
  retiredNumbersChanged: () => [EDGE.retiredNumbers],
  /** 이름 공개 토글이 바로 보이게(최초 기록의 이름 포함). */
  retirementPut: (careerId: string) => [EDGE.hofDetail(careerId), EDGE.firsts],
  /** 글·댓글 쓰기/지우기 — 목록의 글과 댓글 수가 바뀐다. */
  boardChanged: (board: string) => [EDGE.boardFirstPage(board)],
  commentsPurged: allBoardLists,
  /** 팀 등록·편성 저장 — 새 팀이 라이브 랭킹 첫 페이지에 바로 보이게(경기 결과는 TTL로만). */
  teamSaved: (season: number) => [
    EDGE.teamRank(season, 'rating', 1),
    EDGE.teamRank(season, 'ovr', 1),
  ],
  profileDeleted: (careerIds: string[], hadComments: boolean) => [
    ...careerIds.map(EDGE.hofDetail),
    ...(hadComments ? allBoardLists() : []),
  ],
} as const;
