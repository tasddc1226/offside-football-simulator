// UX-008 구단 시각 아이덴티티: 이미지 에셋 없이 팀 id → 이니셜 + 팀 컬러 배지로 12개 구단을
// 곳곳에서 구분한다. 이니셜은 활성 룰셋(packages/content/rulesets/<버전>/ruleset.json)
// teams[].name의 첫 1~2 음절이고, colorVar는 packages/ui/src/tokens.css에 정의한
// --os-team-<id> 커스텀 프로퍼티(라이트·다크 각각 packages/ui/scripts/check-contrast.mjs가
// --os-on-accent와 4.5:1을 검증)를 가리킨다.
//
// 팀 id 기준으로만 동작한다 — 사용자가 shared/team-names.ts의 로컬 오버라이드로 구단 이름을
// 바꿔도 이니셜·색은 그대로다(요구사항 4). 룰셋에 팀이 추가·삭제되면 이 맵과 tokens.css,
// check-contrast.mjs의 TEAM_IDS를 함께 고친다.
export interface TeamIdentity {
  /** 배지에 표시할 1~2자 이니셜. */
  initials: string;
  /** TeamBadge의 colorVar로 그대로 전달하는 CSS 색상 값. */
  colorVar: string;
}

/** 룰셋에 없는(또는 앞으로 추가될) 팀 id를 위한 중립색 폴백. */
const NEUTRAL_FALLBACK: TeamIdentity = { initials: '?', colorVar: 'var(--os-neutral)' };

/** PR 231 리뷰: K3 필러 팀(예: "영월 동강 FC")처럼 TEAM_IDENTITY에 없는 id는 이름이 함께 오면
 * "?" 대신 그 이름에서 이니셜을 뽑는다 — 한글은 앞 2글자(공백·"FC" 등은 건너뛴다), 영문/숫자는
 * 대문자 2자. 이름이 없거나 뽑을 문자가 없으면 기존처럼 "?"로 남긴다. */
function initialsFromName(name: string): string {
  const hangul = (name.match(/[가-힣]/g) ?? []).join('');
  if (hangul.length > 0) return hangul.slice(0, 2);
  const alphanumeric = name.replace(/[^A-Za-z0-9]/g, '');
  if (alphanumeric.length > 0) return alphanumeric.slice(0, 2).toUpperCase();
  return NEUTRAL_FALLBACK.initials;
}

const TEAM_IDENTITY: Record<string, TeamIdentity> = {
  'london-riverside': { initials: '런던', colorVar: 'var(--os-team-suwon-hwahong-fc)' },
  'manchester-foundry': { initials: '맨체', colorVar: 'var(--os-team-seoul-hangang-fc)' },
  'valencia-sol': { initials: '발렌', colorVar: 'var(--os-team-jeju-halla-city)' },
  'sevilla-luz': { initials: '세비', colorVar: 'var(--os-team-pohang-donghae-fc)' },
  'rhein-adler': { initials: '라인', colorVar: 'var(--os-team-gangneung-haesol-fc)' },
  'berlin-unionist': { initials: '베를', colorVar: 'var(--os-team-daegu-palgong-fc)' },
  'torino-stella': { initials: '토리', colorVar: 'var(--os-team-gwangju-mudeung-fc)' },
  'napoli-mare': { initials: '나폴', colorVar: 'var(--os-team-ulsan-pado-fc)' },
  'lyon-lumiere': { initials: '리옹', colorVar: 'var(--os-team-daejeon-gapcheon-fc)' },
  'marseille-port': { initials: '마르', colorVar: 'var(--os-team-incheon-gaetbeol-fc)' },
  'osaka-harbor': { initials: '오사', colorVar: 'var(--os-team-ulsan-pado-fc)' },
  'yokohama-blue': { initials: '요코', colorVar: 'var(--os-team-incheon-gaetbeol-fc)' },
  'porto-atlantico': { initials: '포르', colorVar: 'var(--os-team-suwon-hwahong-fc)' },
  'lisboa-estrela': { initials: '리스', colorVar: 'var(--os-team-jeonju-deulnyeok-united)' },
  // 1.0.0~1.4.0
  'hangang-u18': { initials: '한강', colorVar: 'var(--os-team-hangang-u18)' },
  'seorabeol-united': { initials: '서라', colorVar: 'var(--os-team-seorabeol-united)' },
  'cheongyeon-fc': { initials: '청연', colorVar: 'var(--os-team-cheongyeon-fc)' },
  'gangdong-rovers': { initials: '강동', colorVar: 'var(--os-team-gangdong-rovers)' },
  'onsaemiro-city': { initials: '온새', colorVar: 'var(--os-team-onsaemiro-city)' },
  'byeolbit-united': { initials: '별빛', colorVar: 'var(--os-team-byeolbit-united)' },
  'galmae-town': { initials: '갈매', colorVar: 'var(--os-team-galmae-town)' },
  'noeulhang-fc': { initials: '노을', colorVar: 'var(--os-team-noeulhang-fc)' },
  'geumbit-fc': { initials: '금빛', colorVar: 'var(--os-team-geumbit-fc)' },
  'eunha-rovers': { initials: '은하', colorVar: 'var(--os-team-eunha-rovers)' },
  'gangnaru-united': { initials: '강나', colorVar: 'var(--os-team-gangnaru-united)' },
  'dalbit-town-fc': { initials: '달빛', colorVar: 'var(--os-team-dalbit-town-fc)' },
  // 1.5.0 R리그(B팀)
  'seoul-hangang-fc-b': { initials: '한강B', colorVar: 'var(--os-team-seoul-hangang-fc-b)' },
  // 1.5.0 K1
  'seoul-hangang-fc': { initials: '한강', colorVar: 'var(--os-team-seoul-hangang-fc)' },
  'suwon-hwahong-fc': { initials: '화홍', colorVar: 'var(--os-team-suwon-hwahong-fc)' },
  'incheon-gaetbeol-fc': { initials: '갯벌', colorVar: 'var(--os-team-incheon-gaetbeol-fc)' },
  'jeonju-deulnyeok-united': {
    initials: '들녘',
    colorVar: 'var(--os-team-jeonju-deulnyeok-united)',
  },
  'ulsan-pado-fc': { initials: '파도', colorVar: 'var(--os-team-ulsan-pado-fc)' },
  'pohang-donghae-fc': { initials: '동해', colorVar: 'var(--os-team-pohang-donghae-fc)' },
  'daegu-palgong-fc': { initials: '팔공', colorVar: 'var(--os-team-daegu-palgong-fc)' },
  'jeju-halla-city': { initials: '한라', colorVar: 'var(--os-team-jeju-halla-city)' },
  'gangneung-haesol-fc': { initials: '해솔', colorVar: 'var(--os-team-gangneung-haesol-fc)' },
  'gwangju-mudeung-fc': { initials: '무등', colorVar: 'var(--os-team-gwangju-mudeung-fc)' },
  'daejeon-gapcheon-fc': { initials: '갑천', colorVar: 'var(--os-team-daejeon-gapcheon-fc)' },
  'busan-deungdae-fc': { initials: '등대', colorVar: 'var(--os-team-busan-deungdae-fc)' },
  // 1.5.0 K2
  'anyang-pyeongchon-fc': { initials: '평촌', colorVar: 'var(--os-team-anyang-pyeongchon-fc)' },
  'bucheon-wonmi-fc': { initials: '원미', colorVar: 'var(--os-team-bucheon-wonmi-fc)' },
  'seongnam-tancheon-fc': { initials: '탄천', colorVar: 'var(--os-team-seongnam-tancheon-fc)' },
  'gimpo-pyeongya-fc': { initials: '평야', colorVar: 'var(--os-team-gimpo-pyeongya-fc)' },
  'cheonan-heungtaryeong-fc': {
    initials: '흥타',
    colorVar: 'var(--os-team-cheonan-heungtaryeong-fc)',
  },
  'asan-oncheon-fc': { initials: '온천', colorVar: 'var(--os-team-asan-oncheon-fc)' },
  'cheongju-jikji-fc': { initials: '직지', colorVar: 'var(--os-team-cheongju-jikji-fc)' },
  'changwon-jinhae-fc': { initials: '진해', colorVar: 'var(--os-team-changwon-jinhae-fc)' },
  'gwangyang-maehwa-fc': { initials: '매화', colorVar: 'var(--os-team-gwangyang-maehwa-fc)' },
  'gimcheon-hwangak-fc': { initials: '황악', colorVar: 'var(--os-team-gimcheon-hwangak-fc)' },
  'ansan-gaetgol-fc': { initials: '갯골', colorVar: 'var(--os-team-ansan-gaetgol-fc)' },
  'yongin-hanteo-fc': { initials: '한터', colorVar: 'var(--os-team-yongin-hanteo-fc)' },
  'hwaseong-gukhwa-fc': { initials: '국화', colorVar: 'var(--os-team-hwaseong-gukhwa-fc)' },
  'seoul-namsan-fc': { initials: '남산', colorVar: 'var(--os-team-seoul-namsan-fc)' },
};

/** 알 수 없는 teamId(컵 상대·K3 필러 등 룰셋 밖 id 포함)는 중립색 폴백을 돌려준다 — 호출부가
 * teamName을 함께 주면 "?" 대신 그 이름에서 뽑은 이니셜을 쓴다(initialsFromName). */
export function getTeamIdentity(teamId: string, teamName?: string): TeamIdentity {
  const known = TEAM_IDENTITY[teamId];
  if (known !== undefined) return known;
  if (teamName === undefined) return NEUTRAL_FALLBACK;
  return { initials: initialsFromName(teamName), colorVar: NEUTRAL_FALLBACK.colorVar };
}
