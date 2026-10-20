import { SERVICE_SEASONS } from '@offside/contracts/service-seasons';
import { BOARD_KEYS, BOARD_PAGE_LIMIT } from '@offside/contracts/board-limits';

// T-10-047. 엣지에 담는 공개 조회의 경로(= 캐시 키)와, 쓰기가 낡게 만드는 키를 한곳에 둔다.
// 새 조회를 엣지에 담으면 EDGE에 키를 더하고, 그 데이터를 바꾸는 쓰기를 STALE에 적는다. 와일드카드 퍼지는
// 없다 — 지울 키를 정확히 알 수 없는 조회(명예의 전당 목록처럼 쿼리가 여러 가지)는 TTL로만 새로 읽는다.

export const EDGE = {
  cupHome: '/v1/cups/home',
  cupCurrent: '/v1/cups/current',
  /** T-11-418 오프사이드 리그(일정 · 신청 수). TTL로만 새로 읽는다. */
  leagueCurrent: '/v1/leagues/current',
  /** T-11-410 구간 대회 한 개(회차마다 3개). */
  cupById: (id: string) => `/v1/cups/${id}`,
  balance: '/v1/balance',
  /** T-11-141 공개 밸런스 이력. */
  balanceHistory: '/v1/balance/history',
  adminStats: '/v1/admin/stats',
  /** T-11-029 서버 최초 기록·서버 기록은 시즌마다 따로다(시즌 id를 푼 경로). */
  firsts: (season: number) => `/v1/firsts?season=${season}`,
  /** T-11-029 영구결번은 시즌마다 따로다(시즌 id를 푼 경로). */
  retiredNumbers: (season: number) => `/v1/retired-numbers?season=${season}`,
  /** T-11-101 벽 첫 화면(구단별 수·최근 결번), 한 구단, 최신순 페이지. */
  retiredNumbersSummary: (season: number) => `/v1/retired-numbers/summary?season=${season}`,
  retiredNumbersClub: (season: number, clubId: string) =>
    `/v1/retired-numbers?season=${season}&club=${clubId}`,
  retiredNumbersPage: (season: number, before: number) =>
    `/v1/retired-numbers?season=${season}&before=${before}`,
  live: '/v1/live',
  /** T-11-321 서버 상태 화면. TTL로만 새로 읽는다. */
  serverStatus: '/v1/status',
  /** T-10-122 홈 전광판(이적·최초 기록). TTL로만 새로 읽는다. */
  ticker: '/v1/ticker',
  /** 시즌 진행 게이지(홈). TTL로만 새로 읽는다. */
  seasonGauge: '/v1/season/gauge',
  hofDetail: (careerId: string) => `/v1/hof/${careerId}`,
  hofList: (
    limit: number,
    page: number,
    sort: string,
    season?: number,
    q?: string,
    pos?: string,
    dpos?: string,
  ) =>
    `/v1/hof?limit=${limit}&page=${page}&sort=${sort}${season !== undefined ? `&season=${season}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}${pos ? `&pos=${pos}` : ''}${dpos ? `&dpos=${dpos}` : ''}`,
  /** T-11-257 명예의 전당 전체 인원. 페이지·목록 크기와 상관없어 목록 캐시와 따로 둔다(검색은 담지 않는다). */
  hofCount: (sort: string, season?: number, pos?: string, dpos?: string) =>
    `/_count/hof?sort=${sort}${season !== undefined ? `&season=${season}` : ''}${pos ? `&pos=${pos}` : ''}${dpos ? `&dpos=${dpos}` : ''}`,
  /** T-10-092 라이브 랭킹(팀 랭킹). TTL로만 새로 읽는다(원작처럼 5분마다 갱신). */
  teamRank: (season: number, sort: string, page: number) =>
    `/v1/teams?season=${season}&sort=${sort}&page=${page}&form=5&logo=1`,
  /** T-11-262 업적 랭킹에 오른 구단주 수(클럽하우스 순위의 분모). 모두에게 같다. */
  achRanked: (season: number) => `/_count/ach-ranked?season=${season}`,
  /** T-11-358 한 팀의 경기 통계(팀 프로필). 언어와 상관없이 한 벌만 담는다. */
  teamStats: (teamId: string) => `/v1/teams/${teamId}/stats`,
  /** T-11-028 업적 랭킹(기록실). TTL로만 새로 읽는다. */
  achRank: (season: number, page: number) =>
    `/v1/achievements/ranking?season=${season}&page=${page}&logo=1`,
  /** T-11-080f 시세 차트(시즌 · 기간 · 묶음별). */
  marketChart: (season: number, range: string, group?: { pos: string; band: number }) =>
    `/v1/market/chart?season=${season}&range=${range}${group ? `&pos=${group.pos}&band=${group.band}` : ''}`,
  /** T-11-080 이적시장 목록은 첫 페이지만 담는다(시즌 · 정렬 · 포지션별). */
  marketList: (season: number, sort: string, pos?: string) =>
    `/v1/market?season=${season}&sort=${sort}${pos ? `&pos=${pos}` : ''}`,
  /** 게시판 목록은 첫 페이지(웹 기본 limit)만 담는다. */
  publicNews: (board: string) => `/v1/public-news/${board}`,
  boardFirstPage: (board: string) => `/v1/boards/${board}/posts?limit=${BOARD_PAGE_LIMIT}`,
} as const;

/** 기록이 어느 시즌 것인지 쓰기에서 따지지 않고 모든 시즌(프리시즌 + 시즌들)의 키를 지운다. */
const allFirsts = () => [0, ...SERVICE_SEASONS.map((s) => s.id)].map(EDGE.firsts);
const allBoardLists = () => BOARD_KEYS.map(EDGE.boardFirstPage);

/** 쓰기 → 지울 엣지 키. */
export const STALE = {
  cupChanged: () => [EDGE.cupHome, EDGE.cupCurrent],
  balanceActivated: () => [EDGE.balance, EDGE.balanceHistory],
  /** T-11-333 코드 배포 밸런스 패치가 이력에 쌓였다 — 지금 값은 그대로라 이력만 지운다. */
  balancePatched: () => [EDGE.balanceHistory],
  firstsChanged: allFirsts,
  /** 새 결번·이름 공개 토글 — 그 시즌 전체 목록·요약·그 구단·최신순 첫 페이지(뒤 페이지는 TTL로만). */
  retiredNumbersChanged: (season: number, clubId: string) => [
    EDGE.retiredNumbers(season),
    EDGE.retiredNumbersSummary(season),
    EDGE.retiredNumbersClub(season, clubId),
    EDGE.retiredNumbersPage(season, 0),
  ],
  /** T-11-121 명예의 벽을 받았거나 그 선수가 이름 공개를 바꿨다 — 은퇴 상세와 그 시즌 요약, T-11-234 그 구단. */
  wallOfHonorChanged: (season: number, careerId: string, clubId: string) => [
    EDGE.hofDetail(careerId),
    EDGE.retiredNumbersSummary(season),
    EDGE.retiredNumbersClub(season, clubId),
  ],
  /** 이름 공개 토글이 바로 보이게(최초 기록의 이름 포함). */
  retirementPut: (careerId: string) => [EDGE.hofDetail(careerId), ...allFirsts()],
  /** 글·댓글 쓰기/지우기 — 목록의 글과 댓글 수가 바뀐다. */
  boardChanged: (board: string) => [EDGE.boardFirstPage(board), EDGE.publicNews(board)],
  commentsPurged: allBoardLists,
  /** 팀 등록·편성 저장 — 새 팀이 라이브 랭킹 첫 페이지에 바로 보이게(경기 결과는 TTL로만). */
  teamSaved: (season: number) => [
    EDGE.cupHome,
    EDGE.cupCurrent,
    EDGE.teamRank(season, 'rating', 1),
    EDGE.teamRank(season, 'ovr', 1),
    EDGE.achRank(season, 1),
  ],
  /** T-11-358 랭크 경기 · 친선전을 치렀다 — 두 팀의 경기 통계(컵 경기는 TTL로만). */
  teamMatchPlayed: (homeTeamId: string, awayTeamId: string) => [
    EDGE.teamStats(homeTeamId),
    EDGE.teamStats(awayTeamId),
  ],
  profileDeleted: (careerIds: string[], hadComments: boolean) => [
    EDGE.cupHome,
    EDGE.cupCurrent,
    ...careerIds.map(EDGE.hofDetail),
    ...(hadComments ? allBoardLists() : []),
  ],
} as const;
