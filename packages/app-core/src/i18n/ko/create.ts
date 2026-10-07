// 선수 생성 화면(웹 Create.svelte·NationPicker.svelte·ScoutScan.svelte · 앱 screens/create/*)과 그 표시 로직
// (create-view.ts·nationSearch.ts). 웹·앱 문구가 같아서 키를 함께 쓴다.
import type { AttrKey, Pos } from '@offside/game/data';
import { iGa, withRo } from '../../format.js';
import { ns } from '../core';

// 가장 높은 능력치 하나로 스카우트가 붙이는 선수 유형 이름.
const ARCHETYPE: Record<Pos, Record<AttrKey, string>> = {
  FW: {
    sho: '골잡이',
    pac: '침투형 공격수',
    dri: '테크니션',
    phy: '타깃형 공격수',
    pas: '연계형 공격수',
    def: '전방 압박형 공격수',
  },
  MF: {
    pas: '플레이메이커',
    dri: '드리블러',
    def: '홀딩 미드필더',
    sho: '공격형 미드필더',
    pac: '박스 투 박스',
    phy: '박스 투 박스',
  },
  DF: {
    def: '스토퍼',
    phy: '파이터형 수비수',
    pac: '커버형 수비수',
    pas: '빌드업 수비수',
    dri: '볼 플레잉 수비수',
    sho: '세트피스 헌터',
  },
  GK: {
    def: '슈퍼 세이버',
    pac: '반사 신경형 수문장',
    phy: '안정형 수문장',
    pas: '스위퍼 키퍼',
    dri: '포지셔닝형 키퍼',
    sho: '스위퍼 키퍼',
  },
};

const ko = {
  ovrFocusTitle: (p: { role: string }) => `${p.role} OVR 주요 능력치`,
  ovrFocusSubs: (p: { list: string }) => `주요 세부 능력치: ${p.list}`,
  ovrHeadingGroup: '수비(헤딩)',
  ovrHeadingNote:
    '헤딩은 수비 항목에 있어요. 이 포지션은 수비 항목 중 헤딩 정확도만 OVR에 반영돼요.',
  ovrFocusNote: 'OVR은 선택한 포지션의 세부 능력치를 반영해요. OVR 비중과 훈련 성장률은 달라요.',
  ovrStartNote: '시작 OVR은 카드 능력치로 맞춰요. 육성할 때는 선택한 포지션 기준으로 평가해요.',
  ovrCore: '밑줄 친 능력치는 이 포지션의 OVR 주요 항목이에요.',

  // 제목·라이브 카드
  titleForm: '고교 3학년, 나는 어떤 선수인가',
  titleCandidates: '스카우트 리포트를 비교해 보세요',
  previewLabel: '내 선수 미리보기',
  noName: '이름 없음',
  focusTag: (p: { list: string }) => `주력 ${p.list}`,
  ovrStart: '시작',
  ovrEst: '예상',
  /** 주발 저장값(오른발·왼발·양발)을 화면 문구로. */
  foot: (p: { v: string }) => p.v,
  // 입력 칸
  name: '이름',
  randomName: '이름 랜덤으로 바꾸기',
  number: '등번호',
  nation: '국적',
  nationForeign: (p: { nation: string; cup: string }) =>
    `한국 고교로 축구 유학을 온 선수로 시작해요. ${p.nation} 대표팀에 뽑히고 대륙컵은 ${p.cup}예요. 병역은 없어요.`,
  nationHome:
    '대표팀 대륙컵은 AFC 아시안컵이에요. 병역(상무·현역)이 있고, 아시안게임 금메달·올림픽 금·은·동메달로 체육요원 특례를 받을 수 있어요.',
  nationSame: '대표팀 발탁 기준은 어느 나라든 같아요.',
  body: '체격',
  height: '키',
  weight: '몸무게',
  bodyNote: (p: { bmi: string; note: string }) =>
    `BMI ${p.bmi}${p.note ? ` · ${p.note}` : ' · 포지션 평균 체격'}. 시작 OVR은 같고, 세부 능력치 분포만 조금 달라져요.`,
  position: '포지션',
  detailPosition: '세부 포지션',
  detailNote: '세부 포지션은 은퇴까지 바뀌지 않아요. 능력치 성장·골과 도움 비중이 달라져요.',
  footLabel: '주발',
  focusTitle: (p: { n: number }) => `주력 능력치 · ${p.n}개 선택`,
  focusUp: (p: { d: number; pct: number }) => `시작 +${p.d} · 성장 +${p.pct}%`,
  focusDown: (p: { d: number }) => `시작 ${p.d}`,
  focusNone: '변화 없음',
  trait: '성장 특성',
  potentialNote: '잠재력 평가는 은퇴할 때 공개돼요.',
  // 하단 버튼
  cancel: '취소',
  checkBody: '키·몸무게를 확인해 주세요',
  focusMore: (p: { n: number }) => `주력 능력치를 ${p.n}개 더 골라 주세요`,
  seeCandidates: '후보 3명 보기 →',
  back: '← 다시 입력',
  pickOne: '후보를 한 명 골라 주세요',
  kickoff: (p: { n: number }) => `${withRo(`후보 ${p.n}`)} 킥오프 →`,
  // 후보 카드
  potentialRange: (p: { min: string; max: string }) =>
    `초기 잠재력 ${p.min === p.max ? p.min : `${p.min}–${p.max}`}등급`,
  potentialLocked: '잠재력 등급 범위 미확인',
  potentialAd: '광고 보고 후보 3명 잠재력 보기',
  potentialFree: '후보 3명 잠재력 보기',
  potentialBusy: '광고를 불러오는 중이에요…',
  potentialWatch:
    '광고를 끝까지 보면 후보 3명의 잠재력 등급 범위가 열려요. 광고는 범위를 보여 줄 뿐 잠재력을 바꾸지 않아요.',
  potentialHelp:
    '초기 잠재력 등급 범위예요. 훈련과 강화로 달라질 수 있어요. 잠재력은 모든 유저에게 같은 확률로 정해지고, S 등급은 아주 드물어요.',
  potentialWeb: '앱에서 보상형 광고를 보면 후보 3명의 초기 잠재력 등급 범위를 볼 수 있어요.',
  potentialSaveFailed: '공개 결과를 저장하지 못했어요. 저장 공간을 확인해 주세요.',
  candIntro: '세 후보는 능력치 총합이 같고 분포와 잠재력이 달라요. 카드를 눌러 비교해 보세요.',
  openAll: '모두 열기',
  candNo: (p: { n: number }) => `후보 ${p.n}`,
  picked: '✓ 선택',
  scoutMemo: (p: { k: string }) => `스카우트 메모: 숨은 무기는 ${p.k}`,
  tapToOpen: '탭해서 열기',
  candOpenA11y: (p: { n: number; ovr: number; line: string }) =>
    `후보 ${p.n}, OVR ${p.ovr}, ${p.line}`,
  candClosedA11y: (p: { n: number; k: string }) =>
    `후보 ${p.n}, 스카우트 메모: 숨은 무기는 ${p.k}. 눌러서 열기`,
  // 스카우트 한 줄과 선수 유형
  archetype: (p: { pos: Pos; k: AttrKey }) => ARCHETYPE[p.pos][p.k],
  scoutBoth: (p: { a: string; b: string; kind: string }) =>
    `${p.a}·${p.b}${iGa(p.b)} 고루 좋은 ${p.kind}`,
  scoutOne: (p: { a: string; kind: string }) => `${p.a}${iGa(p.a)} 특출난 ${p.kind}`,
  // 스카우트 연출 단계
  stepVideo: (p: { nation: string }) => `${p.nation} 고교 경기 영상 분석`,
  stepPool: (p: { pos: string }) => `${p.pos} 후보군 추리기`,
  stepFocus: (p: { list: string }) => `주력 ${p.list} 대조`,
  stepBody: (p: { h: number; w: number }) => `체격 ${p.h}cm · ${p.w}kg 비교`,
  stepDone: '능력치 확인 · 후보 3명 확정',
  // 스카우트 연출 화면
  scanTitle: '스카우트가 후보를 추리는 중',
  scanSkipLabel: '스카우트 연출 건너뛰기',
  scannedBefore: '분석한 선수',
  scannedAfter: '명',
  scanCand: '후보',
  scanDone: '후보 3명 선정 완료!',
  scanSkip: '탭하면 건너뛰기',
  // 국적 고르기
  nationSearchPlaceholder: '나라 이름이나 초성(ㅂㄹㅈ)',
  nationListLabel: '국적',
  nationEmpty: '찾는 나라가 없어요',
  nationA11y: (p: { name: string }) => `국적 ${p.name}`,
  nationHint: '누르면 나라를 검색해서 고를 수 있어요',
  nationCloseLabel: '국적 고르기 닫기',
  nationSearchLabel: '국적 검색',
  close: '닫기',
  groupBase: '기본',
  groupHits: (p: { n: number }) => `검색 결과 ${p.n}`,
  // 입력 칸 접근성
  invalidHint: '입력값을 확인해 주세요',
};

export type CreateMsgs = typeof ko;
export const createText = ns('create', ko);
