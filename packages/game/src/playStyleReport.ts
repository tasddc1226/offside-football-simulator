// T-10-077 은퇴 화면 '플레이 성향' 카드 — 커리어 내내 센 선택(style, playStyle.ts)과 시즌 기록으로 유저의 성향을
// 한 유형으로 뽑는다. 기준값은 모든 선택을 무작위로 고른 커리어(골든 테스트의 정책) 200개를 '보통'으로 잡고 정했다
// — 커리어당 선택 약 34번, 확률 선택 약 16번, 승부수 비율 약 15%, 운(실제 − 기대 성공)은 대개 ±2 안.
// 성향 카드(PlayStyleCredit, 지연 로드)만 쓴다 — 첫 화면 번들 밖.
import type { PlayStyle } from '@offside/contracts';
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import { eventById } from './events-data.js';
// 가장 어려웠던 선택의 이벤트 제목을 찾으려면 정의가 등록돼 있어야 한다. T-10-104 뒤로 등록부는 게임 청크에만 있어,
// 게임 화면을 거치지 않고 은퇴 리포트만 열어도(구단주 → 내 선수) 여기서 직접 불러온다(성향 카드는 지연 청크라 첫 화면 밖).
import './event-registry.js';
import type { CareerRecord } from './types.js';

/** 고교·대학 리그 이름(스냅샷 시즌 기록엔 프로 여부가 없어 리그 이름으로 가린다). */
const AMATEUR = new Set(LEAGUE_BASE.filter((l) => l.amateur).map((l) => l.name));
/** 선택이 이보다 적으면 성향을 말하지 않는다. */
const MIN_CHOICES = 8;

export interface StyleType {
  key: string;
  icon: string;
  name: string;
  /** 한 줄 평. */
  line: string;
}
export interface StyleReport {
  type: StyleType;
  /** 대표 유형 말고도 맞는 성향(최대 2개). */
  also: StyleType[];
  /** 센 선택 수(확률 + 안전 + 확정). */
  choices: number;
  bets: number;
  betWins: number;
  /** 운 = 실제 성공 − 기대 성공(소수 첫째 자리). */
  luck: number;
  longshots: number;
  longshotWins: number;
  moves: number;
  tierUp: number;
  /** 윗 리그 제의를 뿌리친 잔류·재계약. */
  snubUp: number;
  /** 가장 낮은 확률로 성공한 선택. 이벤트가 사라졌으면 null. */
  best: { title: string; pct: number } | null;
  /** 커리어 도중부터 셌으면 그 나이(이 기능이 나오기 전에 시작한 커리어). */
  since: number | null;
}

type Signals = {
  st: PlayStyle;
  choices: number;
  luck: number;
  clubs: number;
  proSeasons: number;
};

/** 우선순위 순(앞일수록 드물고 뚜렷하다). 맞는 첫 유형이 대표, 나머지는 곁들인다. */
const TYPES: (StyleType & { hit: (x: Signals) => boolean })[] = [
  {
    key: 'oneclub',
    icon: '🏠',
    name: '원클럽 순정파',
    line: '다른 유니폼은 입어 본 적이 없다. 한 팀에서 끝까지 뛰었다.',
    hit: (x) => x.clubs === 1 && x.proSeasons >= 8,
  },
  {
    key: 'lucky',
    icon: '🍀',
    name: '타고난 강운',
    line: '낮은 확률에 건 선택이 자꾸 들어맞았다. 운도 따라줬다.',
    hit: (x) => x.luck >= 3,
  },
  {
    key: 'allin',
    icon: '🎲',
    name: '올인 승부사',
    line: '확률이 낮을수록 더 걸었다. 안 되면 그만이었다.',
    hit: (x) => x.st.longshots >= 4 && x.st.longshots / x.choices >= 0.25,
  },
  {
    key: 'nomad',
    icon: '🧳',
    name: '축구계 노마드',
    line: '짐은 늘 반쯤 싸 두었다. 가는 곳마다 새 등번호.',
    hit: (x) => x.clubs >= 7,
  },
  {
    key: 'unlucky',
    icon: '🌧️',
    name: '비운의 사나이',
    line: '될 만한 선택도 자꾸 빗나갔다. 운이 따라주지 않았다.',
    hit: (x) => x.luck <= -3,
  },
  {
    key: 'climber',
    icon: '🚀',
    name: '사다리 등반가',
    line: '이적할 때마다 리그 수준이 올라갔다. 늘 한 단계 위만 봤다.',
    hit: (x) => x.st.tierUp >= 4,
  },
  {
    key: 'business',
    icon: '💼',
    name: '연봉 협상의 달인',
    line: '축구는 비즈니스. 계약서의 숫자부터 읽었다.',
    hit: (x) => x.st.payFirst >= 2,
  },
  {
    key: 'loyal',
    icon: '🤝',
    name: '의리의 사나이',
    line: '더 큰 구단이 불러도 고개를 저었다.',
    hit: (x) => x.st.snubUp >= 3,
  },
  {
    key: 'safe',
    icon: '🛡️',
    name: '안전제일주의',
    line: '돌다리도 두들겨 보고 건넜다. 부상 없이 오래가는 게 실력.',
    hit: (x) => x.st.safe / x.choices >= 0.45,
  },
  {
    key: 'calculated',
    icon: '🧮',
    name: '계산된 모험가',
    line: '승부는 걸되, 이길 만한 판에만 걸었다.',
    hit: (x) => x.st.bets / x.choices >= 0.6 && x.st.longshots / x.choices < 0.15,
  },
];
const BALANCED: StyleType = {
  key: 'balanced',
  icon: '⚖️',
  name: '균형 잡힌 현실주의자',
  line: '걸 때와 물러설 때를 가렸다. 큰 기복 없는 커리어.',
};

/** 성향 카드. 선택 기록이 없거나 너무 적으면 null. */
export function styleReport(
  st: PlayStyle | undefined,
  career: Pick<CareerRecord, 'age' | 'club' | 'clubId' | 'league' | 'mil'>[],
): StyleReport | null {
  if (!st) return null;
  const choices = st.bets + st.safe + st.sure;
  if (choices < MIN_CHOICES) return null;
  // 프로 구단 시즌(병역 중 상무 시즌은 빼고 센다 — 원클럽을 깨지 않게).
  const pro = career.filter((r) => !AMATEUR.has(r.league) && !r.mil);
  const x: Signals = {
    st,
    choices,
    luck: Math.round((st.betWins - st.betOdds / 100) * 10) / 10,
    clubs: new Set(pro.map((r) => r.clubId ?? r.club)).size,
    proSeasons: pro.length,
  };
  const [type = BALANCED, ...also] = TYPES.filter((t) => t.hit(x)).map(
    ({ key, icon, name, line }) => ({ key, icon, name, line }),
  );
  const title = st.best && eventById(st.best.id)?.title;
  const start = career[0]?.age;
  return {
    type,
    also: also.slice(0, 2),
    choices,
    bets: st.bets,
    betWins: st.betWins,
    luck: x.luck,
    longshots: st.longshots,
    longshotWins: st.longshotWins,
    moves: st.moves,
    tierUp: st.tierUp,
    snubUp: st.snubUp,
    best: title ? { title, pct: Math.round(st.best!.p * 100) } : null,
    since: start != null && st.from > start ? st.from : null,
  };
}
