import { careerReminderText as reminderKo } from '../i18n/ko/careerReminder.js';
import { careerReminderText as reminderEn } from '../i18n/en/careerReminder.js';
import { careerReminderText as reminderJa } from '../i18n/ja/careerReminder.js';
import { attendanceReminderText as attendanceKo } from '../i18n/ko/attendanceReminder.js';
import { attendanceReminderText as attendanceEn } from '../i18n/en/attendanceReminder.js';
import { attendanceReminderText as attendanceJa } from '../i18n/ja/attendanceReminder.js';
import { giftReminderText as giftKo } from '../i18n/ko/giftReminder.js';
import { giftReminderText as giftEn } from '../i18n/en/giftReminder.js';
import { giftReminderText as giftJa } from '../i18n/ja/giftReminder.js';
import { RETIRED_NUMBER_SCOUTS } from '@offside/contracts/cup';
import { INVITE_REROLLS, INVITE_SCOUTS } from '@offside/contracts/owner-team';
import { OLD_INVITEE, OLD_INVITER, PUSH_JA, PUSH_TAIL_JA } from '../i18n/ja/push.js';
import { cupText } from '../cupText.js';
import type { Lang } from '../lang.js';

// T-11-106 서버가 만든 알림 문구. 푸시는 보낼 때 기기의 언어를 알 수 없어(기기 등록에 언어가 없다) 한국어로 보내고,
// 커리어 독려만 마지막 활동 언어로 발송한다. 알림함은 읽을 때 요청 언어로 바꿔 보여 준다. 공지·릴리즈 노트의 본문(글 제목)은 보낼 때의 한국어 제목이다 — 운영자가 쓴
// 번역(T-11-146 board_posts.i18n_json)은 게시판에서만 고른다.
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
  // T-11-171 친구 초대 알림(키는 db/repos/referrals.ts의 한국어 문구).
  '친구 초대 보상을 받았어요': 'You got the friend invite reward', // i18n-ignore: 번역표 키
  [`커리어를 끝까지 마쳐 선수 후보 리롤권 ${INVITE_REROLLS}장과 프리미엄 스카우트권 ${INVITE_SCOUTS}장을 받았어요.`]: `You finished a career and got ${INVITE_REROLLS} candidate rerolls and ${INVITE_SCOUTS} premium scout ticket.`, // i18n-ignore: 번역표 키
  '초대한 친구가 커리어를 마쳤어요': 'A friend you invited finished a career', // i18n-ignore: 번역표 키
  [`친구 초대 보상으로 선수 후보 리롤권 ${INVITE_REROLLS}장과 프리미엄 스카우트권 ${INVITE_SCOUTS}장을 받았어요.`]: `You got ${INVITE_REROLLS} candidate rerolls and ${INVITE_SCOUTS} premium scout ticket as an invite reward.`, // i18n-ignore: 번역표 키
  // T-11-244 retired number reward (db/repos/itemShop.ts).
  '영구결번 보상을 받았어요': 'You got a retired number reward', // i18n-ignore: 번역표 키
  [`영구결번을 받아 프리미엄 스카우트권 ${RETIRED_NUMBER_SCOUTS}장을 받았어요.`]: `Your number was retired, so you got ${RETIRED_NUMBER_SCOUTS} premium scout ticket.`, // i18n-ignore: 번역표 키
  // Notices sent before T-11-244 (2 rerolls).
  [OLD_INVITEE]: 'You finished a career and got 2 candidate rerolls.',
  [OLD_INVITER]: 'You got 2 candidate rerolls as an invite reward.',
};

/** 팀 이름이 끼는 경기 결과 본문(`원정 0 : 0 홈. …`). 팀 이름은 구단주가 지은 이름이라 그대로 둔다. 끝 문장은 TABLES의 tails 순서. */
const PATTERNS = [
  /^(.+)\. 친구 목록에서 경기 결과를 확인해 주세요\.$/,
  /^(.+)\. 최근 경기에서 결과를 확인해 주세요\.$/,
];

const TABLES: Record<
  Exclude<Lang, 'ko'>,
  { exact: Record<string, string>; tails: readonly string[]; sep: string }
> = {
  en: {
    exact: EN,
    tails: ['Check the result in your friend list.', 'Check the result in Recent matches.'],
    sep: '. ',
  },
  ja: { exact: PUSH_JA, tails: PUSH_TAIL_JA, sep: '。' },
};

export function pushText(ko: string, lang: Lang): string {
  if (lang === 'ko') return ko;
  const reminders = lang === 'en' ? reminderEn : reminderJa;
  for (let i = 0; i < reminderKo.length; i++) {
    if (ko === reminderKo[i]!.title) return reminders[i]!.title;
    if (ko === reminderKo[i]!.body) return reminders[i]!.body;
  }
  // T-11-378 출석 독려.
  const attendance = lang === 'en' ? attendanceEn : attendanceJa;
  if (ko === attendanceKo.title) return attendance.title;
  if (ko === attendanceKo.body) return attendance.body;
  // T-11-388 홈 선물 안내.
  const gift = lang === 'en' ? giftEn : giftJa;
  if (ko === giftKo.title) return gift.title;
  if (ko === giftKo.body) return gift.body;
  const T = TABLES[lang];
  const hit = T.exact[ko];
  if (hit) return hit;
  for (const [i, re] of PATTERNS.entries()) {
    const m = re.exec(ko);
    if (m) return `${m[1]}${T.sep}${T.tails[i]}`;
  }
  return cupText(ko, lang) ?? ko;
}

/** 알림 한 건의 제목·본문을 요청 언어로. 모르는 문구(운영자가 쓴 글)는 그대로 둔다. */
export const localizeNotification = <T extends { title: string; body: string }>(
  n: T,
  lang: Lang,
): T =>
  lang === 'ko' ? n : { ...n, title: pushText(n.title, lang), body: pushText(n.body, lang) };
