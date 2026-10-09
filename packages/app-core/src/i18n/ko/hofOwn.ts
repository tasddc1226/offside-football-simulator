// 내 은퇴 선수 카드(웹 PublishCard.svelte · OwnHofCards.svelte · NameReport.svelte · NicknameForm.svelte, 앱 같은 이름 파일).
// SHORT_CAREER_NOTE는 contracts가 정하는 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  publishTitle: '전체 명예의 전당 이름 공개',
  publishBefore: '은퇴 기록은 모든 유저가 보는 명예의 전당에 올라가요. 지금은',
  publishNamed: (p: { name: string }) => `"${p.name}" 이름으로`,
  publishAnon: '익명으로',
  publishAfter: '표시돼요.',
  publishHint: '이름을 공개하면 다른 유저에게 선수 이름이 보여요. 실명은 쓰지 않는 게 좋아요.',
  publishRevert: '익명으로 되돌리기',
  publishOn: '이름 공개하기',
  shortTitle: '내 선수에만 남는 기록',
  // 이름 신고
  reportTitle: (p: { name: string }) => `'${p.name}' 이름을 신고할까요?`,
  reportBody: '운영자가 확인 후 처리해요.',
  reportConfirm: '신고',
  reportSent: '신고했어요. 운영자가 확인할게요.',
  reportDone: '신고했어요',
  reportBtn: '이름 신고',
  reportLabel: (p: { name: string }) => `${p.name} 이름 신고`,
  reportNickTitle: (p: { name: string }) => `'${p.name}' 닉네임을 신고할까요?`,
  reportNickBtn: '닉네임 신고',
  reportNickLabel: (p: { name: string }) => `${p.name} 닉네임 신고`,
  // 댓글 닉네임
  nickSaved: '닉네임을 정했어요',
  nickLabel: '댓글 닉네임',
  nickPlaceholder: (p: { max: number }) => `댓글 닉네임 (2~${p.max}자)`,
  nickChange: '바꾸기',
  nickSet: '정하기',
};

export type HofOwnMsgs = typeof ko;
export const hofOwnText = ns('hofOwn', ko);
