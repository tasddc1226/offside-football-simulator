// 구단주 허브(웹 Owner.svelte · 앱 screens/owner/Owner.tsx) + 허브가 그리기 전에 만드는 문구(ownerHub.ts).
// 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  hubTitle: '내 구단',
  teamsHeading: '운영 중인 팀',
  operationsHeading: '구단 운영',
  manageTeam: '팀 관리',
  currentSeason: '이번 시즌',
  seasonTierHistory: '시즌별 최종 티어',
  valueInfoTitle: '구단 가치 계산 기준',
  valueInfoFormula: '구단 가치 = 구단 자금 + 보유 선수 카드의 기준가 합계',
  valueInfoOwned: '직접 키운 선수와 영입한 선수를 시즌 구분 없이 모두 포함해요.',
  valueInfoPrice:
    '카드 기준가는 최고 OVR을 기록한 마지막 시즌의 몸값이에요. 몸값은 리그 자금력·OVR·나이로 계산해요.',
  valueInfoFallback:
    '그 시즌의 몸값이 없으면 가장 비쌌던 프로 시즌을 사용하고, 프로 기록도 없으면 1억 원을 적용해요.',
  valueInfoExcluded: '판매 등록 가격이나 레전드 점수를 직접 더하지는 않아요.',
  valueInfoGuest:
    '로그인하지 않은 상태에서는 이 기기에 저장된 현재 시즌 은퇴 선수의 카드 기준가를 합산해요.',
  profileEdit: '프로필 편집',
  profileName: '구단주 이름',
  profileNameNotice:
    '부적절한 구단주 이름은 신고 대상이 될 수 있으며, 확인 후 숨김 처리될 수 있어요.',
  profileHint: '이름과 이미지는 구단주 프로필·댓글·채팅에 함께 표시돼요.',
  profileImagePick: '이미지 고르기',
  profileImageReset: '기본 이미지로 변경',
  profileImageSave: '이미지 저장',
  profileCancel: '취소',
  profileBusy: '이미지를 준비하고 있어요.',
  profileSaved: '프로필 이미지를 바꿨어요.',
  profileImageError: '이미지를 불러오지 못했어요. 다른 파일을 골라 주세요.',
  profilePreview: '프로필 이미지 미리 보기',
  profileImageHint: 'PNG·JPG·WebP, 최대 10MB. 가운데를 정사각형으로 잘라 저장해요.',
  title: '구단주',
  summaryLabel: '구단주 요약',
  /** 닉네임이 없을 때 동그란 아바타에 들어가는 한 글자. */
  avatarInitial: '구',
  guestName: '게스트 구단주',
  guestSub: '기록은 이 기기에만 저장돼요',
  signedInSubWeb: 'Google 계정으로 로그인했어요',
  signedInSubApp: '로그인했어요',
  emptySummary: '첫 커리어를 끝까지 뛰면 은퇴 선수와 레전드 점수가 여기에 쌓여요.',
  statClubValue: '구단 가치',
  statFunds: '구단 자금',
  statRetired: '은퇴 선수',
  statLegend: '레전드 점수',
  statRetiredNumbers: '영구결번',
  playersCount: (p: { n: number; text: string }) => `${p.text}명`,
  numbersCount: (p: { n: number }) => `${p.n}개`,
  fundsLine: (p: { funds: string }) => `구단 자금 ${p.funds}`,
  myTeam: '내 팀',
  manager: (p: { manager: string; formation: string }) => `${p.manager} 감독 · ${p.formation}`,
  teamOvr: (p: { ovr: number }) => `팀 OVR ${p.ovr}`,
  statRecord: '전적',
  statRating: '레이팅',
  statToday: '오늘 경기',
  play: '경기하기',
  teamFailed: '시즌마다 은퇴한 선수로 팀을 꾸려 겨루고, 라이브 랭킹과 구단 업적을 채워요.',
  loading: '불러오는 중…',
  buildTeam: '팀 만들기',
  teamBtnApp: '내 팀 · 시즌 업적',
  marketTitle: '이적시장',
  marketSub: (p: { funds: string }) => `구단 자금 ${p.funds} · 이번 시즌 선수를 사고팔아요`,
  open: '열기',
  /** 잠긴 '내 팀' 카드 가운데 배지. 🔒 뒤 U+FE0E는 글자 모양(이모지 아님) 지정. */
  lockBadge: '\u{1F512}︎ 로그인하면 열려요',
  accountSection: '계정',
  adminTools: '운영 도구',
  // ownerHub.ts
  teamEmptyWith: (p: { season: string; n: number }) =>
    `${p.season}에 은퇴한 내 선수 ${p.n}명으로 팀을 꾸릴 수 있어요. 빈 자리는 유스 선수가 채워요.`,
  teamEmptyNone: (p: { season: string }) =>
    `${p.season}에 뛰고 은퇴한 선수가 생기면 팀을 꾸릴 수 있어요.`,
  locked: (p: { players: number }) =>
    `로그인하면 ${p.players > 0 ? `은퇴한 선수 ${p.players}명으로` : '은퇴한 선수로'} 팀을 꾸려 다른 구단주와 겨뤄요. 하루 경기·라이브 랭킹·시즌 업적이 열려요.`,
};

export type OwnerMsgs = typeof ko;
export const ownerText = ns('owner', ko);
