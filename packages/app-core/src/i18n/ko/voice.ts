// T-11-802 게임 안 '의견 보내기'(웹 VoiceSheet.svelte · HomeVoice.svelte, 앱 screens/voice/VoiceSheet.tsx · home/HomeVoice.tsx).
// 웹 · 앱이 같은 키를 쓴다. 운영 도구 '유저 의견' 탭은 한국어만 쓴다(admin/voices.ts).
import { ns } from '../core';

const ko = {
  entry: '의견 보내기',
  homeTitle: '의견 보내기',
  title: '의견 보내기',
  homeSub: '불편한 점, 바라는 점을 운영자에게 바로 보내요.',
  lead: '불편한 점이나 바라는 점을 짧게 적어 주세요. 운영자가 직접 읽어요.',
  kindLabel: '종류 (고르지 않아도 돼요)',
  kindBug: '버그 · 불편',
  kindIdea: '건의',
  kindOther: '기타',
  /** 스크린 리더용 입력 칸 이름. */
  bodyLabel: '의견 내용',
  placeholder: '하고 싶은 말을 적어 주세요.',
  placeholderBug: '어느 화면에서 무엇을 했을 때 생기는지 적어 주세요.',
  placeholderIdea: '있었으면 하는 기능이나 바뀌었으면 하는 점을 적어 주세요.',
  count: (p: { n: number; max: number }) => `${p.n}/${p.max}자`,
  noteReply:
    '운영자만 읽고, 여기로는 답장을 드리지 않아요. 답이 필요하면 contact@offside-lab.com으로 메일을 보내 주세요.',
  noteContext:
    '앱 버전, 기기 종류(웹 · iOS · Android와 OS 버전), 화면 언어가 함께 전달돼요. 메일 주소나 전화번호는 적지 말아 주세요.',
  privacy: '개인정보처리방침',
  submit: '보내기',
  busy: '보내는 중…',
  close: '닫기',
  empty: '내용을 적어 주세요.',
  short: '두 글자 이상 적어 주세요.',
  fail: '보내지 못했어요. 쓴 내용은 그대로 있어요. 잠시 뒤 다시 눌러 주세요.',
  doneTitle: '잘 받았어요',
  doneBody: '보내 주셔서 고마워요. 운영자가 읽고 업데이트를 정할 때 참고해요.',
};

export type VoiceMsgs = typeof ko;
export const voiceText = ns('voice', ko);
