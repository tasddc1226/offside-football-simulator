// 시즌 결산·이적 시장·은퇴 문구(season.ts)와 K리그2 승격 로그(promotion.ts). 구단·리그·국가 이름은 부른 쪽이 tn()으로 옮겨 넘긴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  // 시즌 결산
  seasonEnd: (p: {
    year: number;
    league: string;
    rank: number;
    apps: number;
    goals: number;
    assists: number;
  }) =>
    `${p.year} 시즌 종료 · ${p.league} ${p.rank}위 · 공식전 ${p.apps}경기 ${p.goals}골 ${p.assists}도움`,
  cwcNote: (p: { stage: string }) => `FIFA 클럽 월드컵 ${p.stage}`,
  exemptNote: (p: { what: string }) => `병역 특례(입대 면제) · ${p.what}`,
  promoted: (p: { club: string; league: string; down: string }) =>
    `${p.club} ${p.league} 승격 확정! 다음 시즌은 ${p.league}에서 뜁니다 (${p.down} 강등)`,
  // 이적 제의 역할
  roleStarter: '주전 보장',
  roleRotation: '로테이션',
  roleBench: '벤치 경쟁',
  roleCoach: '은사의 부름 · 감독 신뢰 두터움',
  roleTrial: '입단 테스트 합격 · 세미프로',
  roleComeback: '하부 리그 · 재기 도전',
  // 병역이 막는 시장
  serveName: '김천 상무 복무 계속',
  serveDesc: (p: { left: number }) => `전역까지 ${p.left}시즌 · 군 복무 중에는 이적할 수 없습니다`,
  serveNote: '국군체육부대 소속으로 복무 중입니다.',
  dueNote: (p: { age: number }) =>
    `만 ${p.age}세. 더 이상 입영을 미룰 수 없습니다. 병역 의무를 이행해야 합니다.`,
  // 고교·대학
  hsNoteOffers: '졸업을 앞두고 프로 구단의 입단 제의가 도착했습니다.',
  hsNoteNone: '아직 프로 스카우트의 눈에 띄지 못했습니다. 대학에서 기량을 더 키워야 합니다.',
  uniName: '대학 진학',
  uniDesc: '4년 이내에 언제든 프로 도전 · 대학리그에서 출전 기회 확보',
  uniNote: (p: { years: number }) => `대학 ${p.years}학년을 마쳤습니다.`,
  uniStayName: '대학 잔류',
  uniStayDesc: (p: { year: number }) => `${p.year}학년으로 한 시즌 더`,
  trialNote: '졸업반. 프로 구단의 제의는 없었지만 K3리그 입단 테스트에 합격했습니다.',
  gradNote: '졸업반. 어느 팀에서도 연락이 오지 않았습니다. 선수의 꿈을 접어야 할지도 모릅니다.',
  // 프로
  stayName: (p: { club: string }) => `${p.club} 잔류`,
  stayDesc: (p: { salary: string; years: number }) => `연봉 ${p.salary} · 계약 ${p.years}년 남음`,
  stayDescPromoted: (p: { league: string; salary: string; years: number }) =>
    `이 구단과 ${p.league} 도전 · 연봉 ${p.salary} · 계약 ${p.years}년 남음`,
  extendName: (p: { club: string }) => `${p.club} 연장 계약`,
  extendDesc: '새 연봉은 이번 시즌부터 적용돼요.',
  contractLeftNote: (p: { club: string; years: number }) =>
    `${p.club}와의 계약이 ${p.years}년 남았습니다.`,
  renewName: (p: { club: string }) => `${p.club} 재계약`,
  renewVeteranDesc: '베테랑 재계약',
  faNote: '계약이 만료되어 FA 신분이 되었습니다.',
  // 시장 안내
  promotedNote: (p: { club: string; league: string; note: string }) =>
    `${p.club}, ${p.league} 승격! ${p.note}`,
  retireAgeNote: (p: { age: number }) =>
    `${p.age}세가 되어 더 이상 현역으로 뛸 수 없습니다. 은퇴를 결정할 시간입니다.`,
  noTeamNote: '더 이상 불러주는 팀이 없습니다. 은퇴를 결정할 시간입니다.',
  veteranNote: (p: { note: string; age: number }) => `${p.note} ${p.age}세가 되면 은퇴합니다.`,
  // 선택 결과 로그
  enrolled: (p: { club: string }) => `${p.club}에 진학했습니다.`,
  renewExtLog: (p: { club: string; ext: number; total: number; salary: string }) =>
    `${p.club}와 ${p.ext}년 연장, 잔여 계약 포함 총 ${p.total}년. 이번 시즌부터 연봉 ${p.salary}`,
  renewLog: (p: { club: string; years: number; salary: string }) =>
    `${p.club}와 ${p.years}년 재계약, 연봉 ${p.salary}`,
  signLog: (p: { club: string; league: string; years: number; salary: string }) =>
    `${p.club}(${p.league}) 입단! ${p.years}년 · 연봉 ${p.salary}`,
  transferPaidLog: (p: {
    from: string;
    club: string;
    league: string;
    fee: string;
    years: number;
    salary: string;
  }) =>
    `${p.from} → ${p.club}(${p.league}) 이적! 이적료 ${p.fee} · ${p.years}년 · 연봉 ${p.salary}`,
  transferFreeLog: (p: {
    from: string;
    club: string;
    league: string;
    years: number;
    salary: string;
  }) => `${p.from} → ${p.club}(${p.league}) 이적! 자유계약 · ${p.years}년 · 연봉 ${p.salary}`,
  retireLog: (p: { age: number }) => `${p.age}세, 정든 그라운드를 떠납니다.`,
  // 레전드 점수 항목
  lgGoals: '골 기여',
  lgAssists: '도움 기여',
  lgCs: '무실점 기여',
  lgApps: '출전',
  lgTrophies: '우승 트로피',
  lgAwards: '개인 수상',
  lgCaps: 'A매치',
  lgPeak: '최고 OVR',
  lgBallonWin: '발롱도르 수상',
  lgBallonRank: '발롱도르 순위',
  lgWc: '월드컵 우승',
  lgCentury: '센추리 클럽',
  lgControl: '경기 장악',
};
export type GSeasonMsgs = typeof ko;
export const gSeasonText = ns('gSeason', ko);
