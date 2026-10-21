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
  // T-11-433 서버 반영 상태(공유 바 위 한 줄, outboxStore.retirementUploadStatus)
  uploadPending: '서버 반영 대기 중이에요.',
  uploadSending: '기록을 서버에 올리는 중…',
  uploadRejected: (p: { reason: string }) => `서버에 올리지 못했어요. ${p.reason}`,
  uploadRetry: '다시 올리기',
  uploadDone: '기록을 서버에 올렸어요.',
  uploadStill: '아직 서버에 닿지 않았어요. 연결되면 다시 올려요.',
  rejectedLink: (p: { reason: string }) =>
    `서버에 올리지 못한 기록이라 링크를 만들 수 없어요. ${p.reason}`,
  rejectNoSeasons: '시즌 기록이 서버에 없어서 은퇴 기록을 받지 않았어요.',
  rejectName: '공개할 수 없는 이름이에요. 이름 공개를 끄면 다시 올려요.',
  rejectTooLarge: '기록이 너무 커서 서버가 받지 않았어요.',
  rejectOwner: '다른 계정에 있는 커리어라 이 계정으로 올리지 못했어요.',
  rejectInvalid: '기록 형식이 맞지 않아 서버가 받지 않았어요.',
  rejectUnknown: '서버가 이 기록을 받지 않았어요.',
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
  // T-11-439 칭호·결번이 바뀐 뒤 이미 만든 이미지(B2), 앱은 공유 시트 하나로 저장도 한다(B7).
  imageStale: '칭호나 결번이 바뀌었어요. 다시 만들면 카드에 반영돼요.',
  imageRefresh: '바뀐 내용 반영하기',
  imageShareOrSave: '공유하거나 저장하기',
  imageSheetNote: '저장하려면 공유 창에서 이미지 저장이나 사진 앱을 골라요.',
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
