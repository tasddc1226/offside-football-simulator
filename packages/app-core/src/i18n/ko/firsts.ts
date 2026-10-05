// 서버 최초 업적(웹 firsts/Firsts.svelte · 앱 screens/hof/Firsts.tsx · app-core firsts.ts).
// 기록 이름(label)·단위는 서버가 보내는 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  title: '서버 최초 업적',
  introRecords: (p: { records: boolean }) =>
    `${p.records ? '모든 플레이어 중 가장 높은 기록이에요. 더 큰 기록이 나오면 주인이 바뀌어요.' : '모든 플레이어를 통틀어 가장 먼저 세운 기록만 남아요.'} 이름은 명예의 전당에 이름을 공개한 선수만 보여요.`,
  seasonLabel: '시즌',
  tabsLabel: '기록 분류',
  loadFailed: '서버 최초 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  loading: '불러오는 중…',
  empty: '아직 세워진 서버 최초 기록이 없어요.',
  noRecord: '아직 기록 없음',
  locked: '미달성',
  mine: '내 선수',
};

export type FirstsMsgs = typeof ko;
export const firstsText = ns('firsts', ko);
