import type { Lang } from '../lang.js';

// T-11-106 서버가 만든 알림 문구. 푸시는 보낼 때 기기의 언어를 알 수 없어(기기 등록에 언어가 없다) 한국어로 보내고,
// 알림함은 읽을 때 요청 언어로 바꿔 보여 준다. 공지·릴리즈 노트의 본문(글 제목)은 운영자가 쓴 글이라 옮기지 않는다.
const EN: Record<string, string> = {
  '오프사이드 공지': 'OFFSIDE notice',
  '오프사이드 릴리즈 노트': 'OFFSIDE release notes',
  '오프사이드 알림 테스트': 'OFFSIDE notification test',
  '이 기기의 알림 연결을 확인하는 테스트예요.':
    'This is a test to check the notification connection on this device.',
  '공지와 릴리즈 노트 알림이 연결됐어요.': 'Notices and release note alerts are connected.',
  '다시 킥오프할까요?': 'Ready to kick off again?',
  '오프사이드에서 이어갈 커리어와 새 소식을 확인해요.':
    'Check the careers you can continue and the latest news in OFFSIDE.',
};

export const pushText = (ko: string, lang: Lang): string => (lang === 'en' ? (EN[ko] ?? ko) : ko);

/** 알림 한 건의 제목·본문을 요청 언어로. 모르는 문구(운영자가 쓴 글)는 그대로 둔다. */
export const localizeNotification = <T extends { title: string; body: string }>(
  n: T,
  lang: Lang,
): T =>
  lang === 'en' ? { ...n, title: pushText(n.title, lang), body: pushText(n.body, lang) } : n;
