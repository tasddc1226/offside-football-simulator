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
    'Continue your career and catch up on the latest news in OFFSIDE.',
  '등록한 선수가 이적했어요': 'Your listed player was transferred',
  '판매가 완료됐어요. 이적시장에서 판매 내역과 구단 자금을 확인해 주세요.':
    'The sale is complete. Check your sales and club funds in the transfer market.',
  '친구 신청이 수락됐어요': 'Your friend request was accepted',
  '친구 목록에서 새 친구와 친선전을 즐겨요.':
    'Play a friendly with your new friend from your friend list.',
  '새 친구 신청이 왔어요': 'You have a new friend request',
  '친구 목록에서 받은 신청을 확인해 주세요.': 'Check the request in your friend list.',
  '친선전 결과가 도착했어요': 'Your friendly result is in',
  '내 팀에 새 경기 결과가 있어요': 'Your team has a new match result',
};

/** 팀 이름이 끼는 경기 결과 본문(`원정 0 : 0 홈. …`). 팀 이름은 구단주가 지은 이름이라 그대로 둔다. */
const PATTERNS: [RegExp, string][] = [
  [/^(.+)\. 친구 목록에서 경기 결과를 확인해 주세요\.$/, 'Check the result in your friend list.'],
  [/^(.+)\. 최근 경기에서 결과를 확인해 주세요\.$/, 'Check the result in Recent matches.'],
];

export function pushText(ko: string, lang: Lang): string {
  if (lang !== 'en') return ko;
  const hit = EN[ko];
  if (hit) return hit;
  for (const [re, tail] of PATTERNS) {
    const m = re.exec(ko);
    if (m) return `${m[1]}. ${tail}`;
  }
  return ko;
}

/** 알림 한 건의 제목·본문을 요청 언어로. 모르는 문구(운영자가 쓴 글)는 그대로 둔다. */
export const localizeNotification = <T extends { title: string; body: string }>(
  n: T,
  lang: Lang,
): T =>
  lang === 'en' ? { ...n, title: pushText(n.title, lang), body: pushText(n.body, lang) } : n;
