// 팀 경기 화면(웹 TeamOpponents · TeamResult · TeamHistory · TeamMatchRow · TeamShare · teamShareCard,
// 앱 TeamOpponents · TeamResult · TeamHistory · TeamShare). 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  // 상대 고르기
  oppTitle: '상대 고르기',
  oppNear: (p: { rating: number; left: number; per: number }) =>
    `내 팀 레이팅 ${p.rating}점 근처의 팀이에요 · 오늘 남은 경기 ${p.left}/${p.per}`,
  oppRating: '레이팅',
  oppOvr: (p: { n: number }) => `OVR ${p.n}`,
  oppRuleWeb: (p: { days: number }) =>
    `같은 팀에는 하루 한 번 도전할 수 있어요. 최근 ${p.days}일 안에 다시 만난 팀이면 레이팅이 덜 움직여요.`,
  oppRuleApp: (p: { days: number }) =>
    `같은 팀에는 하루 한 번 도전할 수 있어요. 최근 ${p.days}일 안에 만난 팀과 다시 경기하면 레이팅 변화가 줄어요.`,
  saveToSee: '바꾼 내용을 저장하면 상대를 볼 수 있어요.',
  saveAndFind: '변경 저장 후 상대 보기',
  saving: '저장 중…',
  toLineup: '편성으로',
  oppLoadFail: '상대를 불러오지 못했어요.',
  challenge: '도전',
  challengeAria: (p: { name: string }) => `${p.name}에 도전`,
  noOpponents: '아직 겨룰 팀이 없어요. 다른 구단주가 팀을 꾸리면 여기에 나와요.',
  moreOpponents: '다른 상대 보기',
  // 최근 경기
  historyTitle: '최근 경기',
  historyFail: '경기 기록을 불러오지 못했어요.',
  historyEmpty: '아직 치른 경기가 없어요.',
  kindFriendly: '친선전',
  kindChallenge: '도전',
  kindChallenged: '도전받음',
  // 경기 결과
  assist: (p: { name: string }) => `도움 ${p.name}`,
  noGoals: '골 없이 비겼어요.',
  resultRecord: (p: { record: string }) => ` · 내 팀 ${p.record}`,
  ratingChange: '내 팀 레이팅 ',
  backHistory: '기록으로 돌아가기',
  backDefaultApp: '내 팀',
  replay: '중계 다시 보기',
  again: '다시 경기하기',
  scoreAria: (p: { h: number; a: number }) => `${p.h} 대 ${p.a}`,
  // 공유 이미지(대화상자)
  shareTitle: 'SNS 공유 이미지',
  shareLeadWeb: '지금 보고 있는 편성을 한 장에 담았어요.',
  shareLeadApp: '지금 보고 있는 편성을 한 장에 담아요.',
  shareDraftNote: '저장 전 편성도 이미지에 포함돼요.',
  shareCloseAria: '공유 이미지 닫기',
  shareMakeFail: '이미지를 만들지 못했어요. 다시 눌러 주세요.',
  shareOpenFailWeb: '공유를 열지 못했어요. 이미지 저장을 눌러 주세요.',
  shareOpenFailApp: '공유 창을 열지 못했어요. 다시 눌러 주세요.',
  shareUnavailableApp: '이 기기에서는 이미지를 공유할 수 없어요.',
  shareTitleWeb: (p: { name: string }) => `${p.name} 편성`,
  shareTextWeb: (p: { name: string }) => `${p.name}의 그라운드. 오프사이드 offside-lab.com`,
  shareAltWeb: (p: { name: string }) => `${p.name}의 선수 배치와 팀 전력을 담은 공유 이미지`,
  shareAltApp: (p: { name: string }) => `${p.name} 편성 공유 이미지`,
  shareMaking: '이미지를 만드는 중이에요…',
  saveImage: '이미지 저장',
  shareNow: '바로 공유',
  makingBtn: '만드는 중…',
  remake: '다시 만들기',
  makeImageApp: '공유 이미지 만들기',
  shareDialogApp: '팀 편성 공유',
  // 공유 이미지(그림)
  cardBrand: '오프사이드',
  cardManagerWeb: (p: { name: string }) => `${p.name} 감독 · `,
  cardStarters: (p: { n: number }) => `선발 ${p.n}/11`,
  cardFootWeb: '카드: 최고 OVR · 포지션 OVR: 경기 실력',
  cardManagerApp: (p: { name: string }) => `${p.name} 감독`,
  cardUnsavedApp: ' · 저장 전',
  cardFootApp: '카드 OVR은 최고 실력 · 배치는 해당 자리 실력',
  cardTaglineApp: '나만의 축구 커리어 · offside-lab.com',
};

export type TeamMatchMsgs = typeof ko;
export const teamMatchText = ns('teamMatch', ko);
