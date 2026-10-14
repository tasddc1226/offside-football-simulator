// ───────── 팬 반응 대사 풀 (T-10-002) ─────────
// 전부 이 프로젝트를 위해 새로 쓴 원문이다(다른 게임 텍스트를 옮기지 않음). 버킷별로 나눠 두고,
// game/fanfeed.ts가 시즌 성적에 맞는 버킷을 고른 뒤 그 안에서 결정적으로(RNG 미사용) 한 줄을
// 뽑는다. 각 버킷 최소 5줄 이상, 전체 60줄 이상을 유지한다.
import { gFanfeedText as L } from './i18n/ko/gFanfeed.js';

export type FanBucket =
  | 'rating_high'
  | 'rating_low'
  | 'goals_high'
  | 'assists_high'
  | 'cs_high'
  | 'rank_champion'
  | 'rank_mid'
  | 'rank_low'
  | 'role_main'
  | 'role_bench'
  | 'trophy'
  | 'injury'
  | 'transfer'
  | 'milestone'
  // T-10-034: 성적과 무관한 응원. 맞는 버킷이 모자랄 때 채우는 용도로만 쓴다(사실을 주장하지 않는다).
  | 'general'
  // T-11-236 인기(fame) 구간마다 다른 목소리 — 가족·학교·동네 응원, 늘어나는 팬, 해외 팬·스타 반응.
  | 'fans_local'
  | 'fans_growing'
  | 'fans_star'
  // T-11-264 지난 시즌과 견준 흐름 — 좋아진 시즌·나빠진 시즌에 팬 반응이 달라진다.
  | 'trend_up'
  | 'trend_down';

/** 지금 언어의 대사 풀. 버킷마다 줄 수·순서가 언어와 상관없이 같다(해시로 고른 번호가 같은 줄을 가리킨다). */
const pool = (key: FanBucket): string[] => L[key].split('\n');

// 읽을 때마다 지금 언어로 고른다(모듈 로드 때 굳히지 않는다).
export const FAN_LINES: Record<FanBucket, string[]> = {
  get rating_high() {
    return pool('rating_high');
  },
  get rating_low() {
    return pool('rating_low');
  },
  get goals_high() {
    return pool('goals_high');
  },
  get assists_high() {
    return pool('assists_high');
  },
  get cs_high() {
    return pool('cs_high');
  },
  get rank_champion() {
    return pool('rank_champion');
  },
  get rank_mid() {
    return pool('rank_mid');
  },
  get rank_low() {
    return pool('rank_low');
  },
  get role_main() {
    return pool('role_main');
  },
  get role_bench() {
    return pool('role_bench');
  },
  get trophy() {
    return pool('trophy');
  },
  get injury() {
    return pool('injury');
  },
  get transfer() {
    return pool('transfer');
  },
  get general() {
    return pool('general');
  },
  get milestone() {
    return pool('milestone');
  },
  get fans_local() {
    return pool('fans_local');
  },
  get fans_growing() {
    return pool('fans_growing');
  },
  get fans_star() {
    return pool('fans_star');
  },
  get trend_up() {
    return pool('trend_up');
  },
  get trend_down() {
    return pool('trend_down');
  },
};
