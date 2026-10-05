// 은퇴 커리어 공유(웹 ShareBar.svelte · SharedCareer.svelte · share/ShareImageCard.svelte, 앱 screens/retired/ShareBar · Shared ·
// ShareImageCard · ShareCardView, app-core shareLink.ts · shareCard.ts). 공유 이미지 카드의 구단·리그·칭호·우승 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  // 공유 바
  linkCopied: '공유 링크를 복사했어요.',
  linkCopyHint: '위 링크를 복사해 공유해 주세요.',
  linkLabel: '공유 링크',
  home: '홈으로',
  making: '링크 만드는 중…',
  recopy: '링크 다시 복사',
  shareCareer: '커리어 공유하기',
  // 링크 확인(shareLink.ts)
  linkTitle: '오프사이드 은퇴 커리어',
  linkText: '내 선수의 축구 인생. 오프사이드 offside-lab.com',
  notUploaded: '기록을 아직 서버에 올리지 못했어요. 잠시 후 다시 시도해 주세요.',
  noConnection: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  // 공유받은 커리어
  loading: '기록을 불러오는 중…',
  missingTitle: '기록을 찾을 수 없어요',
  errorTitle: '기록을 불러오지 못했어요',
  missingBody: '링크가 잘못되었거나 더 이상 공개되지 않는 기록이에요.',
  errorBody: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  retry: '다시 시도',
  ctaGame: '내 커리어로 가기 →',
  ctaNew: '나도 커리어 시작하기 →',
  viewNote: '공유받은 은퇴 커리어 · 보기 전용',
  turnTitle: '이번엔 내 선수를 키울 차례예요',
  turnBodyWeb: '고3부터 은퇴까지, 내 선수를 키워요.',
  turnBodyApp: '고3 킥오프부터 은퇴 휘슬까지, 내 선수의 커리어를 직접 정해요.',
  // 공유 이미지
  imageTitle: 'SNS 공유 이미지',
  imageAlt: (p: { name: string }) => `${p.name} 커리어 공유 이미지`,
  imageSave: '이미지 저장',
  imageSend: '바로 공유하기',
  imageRemake: '다시 만들기',
  imageNote: '인스타그램·카카오톡에 공유할 커리어 카드를 만들어요.',
  imageMaking: '만드는 중…',
  imageMake: '공유 이미지 만들기',
  imageFailed: '이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
  imageText: (p: { name: string }) => `${p.name}의 축구 인생. 오프사이드 offside-lab.com`,
  imageCannotShare: '이 기기에서는 이미지를 공유할 수 없어요.',
  imageShareFailed: '공유 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.',
  imageShareDialog: '커리어 카드 공유',
  // 카드 그림 속 글(shareCard.ts)
  cardSeasons: '시즌',
  cardApps: '경기',
  cardCleanSheets: '무실점',
  cardGoals: '골',
  cardAssists: '도움',
  cardTrophies: '트로피',
  cardPeak: (p: { peak: number }) => `최고 OVR ${p.peak}`,
  cardRnTail: (p: { number: number }) => ` 영구결번 ${p.number}`,
  cardRetiredAge: (p: { age: number }) => `${p.age}세 은퇴`,
  cardBest: (p: { pct: number; title: string }) =>
    `성공 확률 ${p.pct}%의 ‘${p.title}’, 기어이 해냈다`,
  cardTagline: '고3부터 은퇴까지, 한 선수의 인생',
  cardBrand: '오프사이드',
};

export type ShareMsgs = typeof ko;
export const shareText = ns('share', ko);
