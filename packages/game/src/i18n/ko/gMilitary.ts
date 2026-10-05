// 병역 문구(military.ts) — 로그·이적 시장 안내·선택지 설명·상태 줄. 이벤트(모집 공고)는 en/events-military.ts가 맡는다.
// 메달·구단·리그·특례 이름은 저장값이라 호출하는 쪽이 tn()으로 옮겨 넘긴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  sportsNotice:
    '대한민국 선수는 대회 명단에 들어 아시안게임 금메달이나 올림픽 금·은·동메달을 받으면 병역 특례를 받아요. 상무나 현역 입대 없이 선수 생활을 이어 가요. 출전 경기 수는 조건이 아니고, 아시안컵·월드컵 우승은 대상이 아니에요. 법적으로는 체육요원 편입이라 기초군사훈련과 544시간 봉사활동을 하고, 34개월 동안 선수로 뛰면 복무를 마쳐요. 게임에서는 시즌이 지나면 자동으로 채워져요. 상무에서 전환하면 남은 복무 비율만큼 기간과 봉사 시간이 줄고, 이미 마친 군사교육은 다시 받지 않아요.',
  sportsLegacyNotice:
    '기존 특례 기록에는 복무 기간이 없어 남은 기간을 표시하지 않아요. 특례와 선수 활동은 그대로 유지돼요.',
  sportsGranted: (p: { medal: string; serving: boolean }) =>
    `병역 특례 대상입니다. ${p.medal}을 받아 상무나 현역 입대 없이 선수 생활을 이어 갑니다.${p.serving ? ' 이번 시즌 상무 복무를 마친 뒤 체육요원으로 전환합니다. 남은 복무 비율만큼 기간과 봉사 시간이 줄고, 이미 마친 군사교육은 다시 받지 않습니다.' : ' 법적으로는 체육요원 편입이라 기초군사훈련과 544시간 봉사활동을 하고, 34개월 동안 선수로 뛰면 복무를 마칩니다.'}`,
  sportsDoneLog: '체육요원 복무 기간을 마쳤습니다. 기초군사훈련과 봉사활동도 모두 마쳤습니다.',
  sportsDoneNote: '체육요원 복무 완료',

  // 상태 줄(선수 탭)
  statusForeign: '해당 없음 (외국 국적)',
  statusExemptServing: (p: { exempt: string }) =>
    `체육요원 편입 예정 · 시즌 종료 후 상무 전환 (${p.exempt})`,
  statusExemptLegacy: (p: { exempt: string }) => `체육요원 특례 · 기존 기록 (${p.exempt})`,
  statusExemptLeft: (p: { seasons: number; exempt: string }) =>
    `병역 특례 · 체육요원 복무 중 · 약 ${p.seasons}시즌 남음 (${p.exempt})`,
  statusExemptDone: (p: { exempt: string }) => `병역 특례 · 체육요원 복무 완료 (${p.exempt})`,
  statusServing: (p: { left: number }) => `상무 복무 중 · 전역까지 ${p.left}시즌`,
  statusServedArmy: '현역 만기 전역',
  statusServedSangmu: '상무 만기 전역',
  statusAccepted: '상무 최종 합격 · 입대 대기',
  statusArmyNext: '현역 입대 예정 (시즌 종료 후)',
  statusApplied: '상무 지원 · 시즌 종료 후 발표',
  statusUnservedAmateur: '미필',
  statusUnserved: (p: { age: number }) => `미필 · 만 ${p.age}세까지 이행 필요`,

  // 이적 시장 선택지
  sangmuName: (p: { due: boolean }): string =>
    p.due ? '국군체육부대(상무) 마지막 지원' : '국군체육부대(상무) 추가 모집 지원',
  sangmuDesc: (p: { pct: number; abroad: boolean; due: boolean }) =>
    `합격 확률 ${p.pct}% · 김천 상무에서 2시즌 복무하며 K리그1 출전${p.abroad ? ' · 해외 구단과의 계약은 해지됩니다' : ' · 전역 후 원소속팀 복귀'}${p.due ? ' · 불합격 시 현역 입대' : ' · 불합격 시 현 소속팀 잔류'}`,
  armyName: (p: { due: boolean }): string => (p.due ? '현역 입대' : '현역 입대 (조기 이행)'),
  armyDesc: (p: { abroad: boolean }) =>
    `18개월 복무 · 2시즌 동안 공식 경기 출전 불가${p.abroad ? ' · 해외 구단과의 계약 해지' : ''}, 전역 후 원소속팀 복귀 협상`,
  armyNote: '입영 통지서가 도착했습니다. 약속대로 현역으로 입대합니다.',
  serveName: '김천 상무 입대',
  serveDesc: (p: { abroad: boolean; from: string; clash: boolean }) =>
    `복무 2시즌 · K리그1 출전${p.abroad ? ` · ${p.from} 계약 해지` : ` · 전역 후 ${p.from} 복귀`}${p.clash ? ' · 복무 중에도 대표팀에 뽑힐 수 있고, 메달을 따면 체육요원으로 전환' : ''}`,
  serveNote: (p: { clash: string[] }) =>
    p.clash.length
      ? `국군체육부대 최종 합격자 명단에 이름이 올랐습니다. 복무 기간에 ${p.clash.join(' · ')}이 열립니다. 상무 소속으로도 대표팀에 뽑힐 수 있습니다.`
      : '국군체육부대 최종 합격자 명단에 이름이 올랐습니다.',
  /** 복무 중에 열리는 특례 대회 이름. */
  hopeAg: (p: { y: number }) => `${p.y} 아시안게임`,
  hopeOl: (p: { y: number }) => `${p.y} 올림픽`,

  // 로그
  enlistAbroad: (p: { club: string }) =>
    `국군체육부대 입대. ${p.club} 구단과의 계약을 해지하고 귀국해 김천 상무 유니폼을 입습니다. 복무 기간은 2시즌입니다.`,
  enlistHome: '국군체육부대 최종 합격! 김천 상무 유니폼을 입습니다. 복무 기간은 2시즌입니다.',
  armyDone: (p: { abroad: boolean; club: string; league: string }) =>
    `18개월의 현역 복무를 마치고 만기 전역했습니다. 몸을 다시 만들어야 합니다. ${p.abroad ? `${p.club} 구단과의 계약은 입대 때 해지돼 새 팀을 찾아야 합니다.` : `${p.league} 복귀에 도전합니다.`}`,
  sangmuAcceptedLog: '국군체육부대 최종 합격! 다음 시즌 김천 상무에 입대합니다.',
  sangmuRejectedLog: '국군체육부대 불합격. 다음 모집에 다시 도전할 수 있습니다.',
  returnedLog: (p: { early: boolean; abroad: boolean; club: string }) =>
    `${p.early ? '상무 복무를 마치고 체육요원으로 전환' : '김천 상무에서 만기 전역'}! ${p.abroad ? `계약이 해지됐던 ${p.club} 구단과 복귀 협상에 나섭니다.` : `원소속팀인 ${p.club} 구단으로 돌아갑니다.`}`,

  // 시즌 결산 줄
  noteCancelled: '병역 특례로 상무 지원 취소',
  noteAccepted: '상무 최종 합격 · 다음 시즌 입대',
  noteRejected: '상무 불합격',
  noteOneLeft: '상무 복무 1시즌 남음',
  noteReturned: (p: { early: boolean; abroad: boolean; club: string }) =>
    `${p.early ? '체육요원 전환' : '상무 만기 전역'} → ${p.club} ${p.abroad ? '복귀 협상' : '복귀'}`,

  // 선택 결과
  resultServeFirst: '김천 상무에 입대했습니다. 2시즌 동안 K리그1 무대에서 뛰며 병역을 이행합니다.',
  resultServeNext: (p: { left: number }) =>
    `김천 상무 복무를 이어갑니다. 전역까지 ${p.left}시즌 남았습니다.`,
  resultSangmuPass: '국군체육부대 최종 합격! 김천 상무에서 2시즌 동안 뛰며 병역을 이행합니다.',
  resultSangmuFailArmy:
    '상무 불합격… 만 28세 입영 기한에 걸려 현역으로 입대했습니다. 18개월 뒤 다시 그라운드를 밟습니다.',
  resultSangmuFailNoTeam:
    '상무 불합격. 다음 모집에 다시 도전할 수 있습니다. 먼저 뛸 팀을 정하세요.',
  resultSangmuFailStay: '상무 불합격. 현 소속팀에서 한 시즌 더 뛰며 다시 도전합니다.',
  resultArmy: '현역으로 입대했습니다. 18개월 뒤 전역해 복귀를 준비합니다.',
};
export type GMilitaryMsgs = typeof ko;
export const gMilitaryText = ns('gMilitary', ko);
