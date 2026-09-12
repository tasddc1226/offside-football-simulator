// 이슈 104(이름 충돌 부분): 게임 속 등장인물과 같은 선수 이름을 SCR-002에서 거부하기 위한 정적 목록.
//
// 출처(2026-09-12 기준, packages/content/packs/<버전>/narrative/tokens.json의 manager·rival·captain·agent):
//   - 0.1.0: manager 정우성 / rival 이도현 / captain 박준서 / agent 하지훈
//   - 0.2.0~0.5.0: 위에 더해 manager 강태원·백진호·홍석민, rival 노형준·배승현·조승민,
//     captain 신도현·오태민·임재현, agent 노한결·유단비·장서온·조민호·윤재하·서도경
//   이벤트 본문에 직접 적힌 이름(예: 0.1.0 EVT-REL-001 situation의 "이도현"·"박준서")도 모두 위 토큰과
//   같은 인물이라 별도 항목이 없다.
//
// 포함하지 않는 것:
//   - tokens.json의 `name`("김서준")은 NPC가 아니라 플레이어 이름 자리표시자(기본 이름)라 예약하지 않는다.
//   - 룰셋 `competitorNames`(경쟁자 무작위 이름 풀 40개, "김서준"·"김민준" 등 흔한 이름)는 저작된
//     인물이 아니고 플레이어의 기본 이름까지 막게 되므로 예약하지 않는다. 경쟁자와의 이름 충돌은
//     domain이 경쟁자 생성 시 플레이어 이름을 풀에서 제외하는 방식(새 룰셋 버전)으로 푸는 것이 맞다.
//
// 유지보수: 새 콘텐츠 팩 버전에서 인물 토큰을 추가하면 이 목록에도 같은 이름을 넣는다.
// `reserved-names.test.ts`가 `PACK_VERSIONS` 전체의 tokens.json을 읽어 누락을 잡는다(가나다순 정렬 유지).
export const RESERVED_PLAYER_NAMES: readonly string[] = [
  '강태원',
  '노한결',
  '노형준',
  '박준서',
  '배승현',
  '백진호',
  '서도경',
  '신도현',
  '오태민',
  '유단비',
  '윤재하',
  '이도현',
  '임재현',
  '장서온',
  '정우성',
  '조민호',
  '조승민',
  '하지훈',
  '홍석민',
];

/** 공백·허용 구분 문자(`·`·`-`·`'`)를 빼고 대소문자를 무시해 비교한다("이 도현"·"이-도현"도 같은 이름). */
export function normalizePlayerNameForComparison(name: string): string {
  return name.replace(/[\s·\-'’]/g, '').toLowerCase();
}

const RESERVED_NORMALIZED = new Set(RESERVED_PLAYER_NAMES.map(normalizePlayerNameForComparison));

export function isReservedPlayerName(name: string): boolean {
  return RESERVED_NORMALIZED.has(normalizePlayerNameForComparison(name));
}
