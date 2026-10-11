import { EXACT_JA, PATTERNS_JA } from './i18n/ja/errorText.js';
import { cupText } from './cupText.js';
import type { Lang } from './lang.js';

// T-11-106 사용자에게 보이는 오류 안내의 영어. 던지는 자리(라우트·미들웨어)는 한국어 문장 그대로 두고, 응답 봉투를 만들 때
// 요청 언어가 영어면 이 표로 바꾼다 — 한국어 응답은 한 글자도 달라지지 않는다. 기계가 읽는 code·details.reason은 그대로다.
// 운영 도구(admin)에만 보이는 문장과 서버 로그용 Error 메시지는 옮기지 않는다. 표에 없는 문장은 한국어로 나간다.
const EXACT: Record<string, string> = {
  // 공통
  '입력 내용을 확인해 주세요.': 'Please check what you entered.',
  '일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.':
    'Something went wrong. Please try again in a moment.',
  '요청한 경로를 찾을 수 없어요.': "We couldn't find what you asked for.",
  '요청 데이터가 너무 커요.': 'The request is too large.',
  '요청 데이터 형식이 올바르지 않아요.': "The request format isn't valid.",
  '요청 데이터를 읽지 못했어요. 다시 시도해 주세요.':
    "We couldn't read the request. Please try again.",
  '요청 식별 정보가 없어요. 다시 시도해 주세요.': 'The request ID is missing. Please try again.',
  '요청 식별 정보가 겹쳤어요. 다시 시도해 주세요.':
    'The request ID was already used. Please try again.',
  '이 접속 경로에서는 요청할 수 없어요.': "Requests aren't allowed from here.",
  '접속 정보가 없어요. 다시 연결해 주세요.': 'Your session is missing. Please reconnect.',
  '접속 정보가 만료됐어요. 다시 연결해 주세요.': 'Your session has expired. Please reconnect.',
  '프로필을 찾을 수 없어요.': "We couldn't find your profile.",
  // 로그인 · 프로필 · 복구
  '지금은 구글 로그인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.':
    "Google sign-in isn't available right now. Please try again in a moment.",
  // i18n-ignore: 응답 문장을 찾는 한국어 원문 키
  '지금은 Apple 로그인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.':
    "Apple sign-in isn't available right now. Please try again in a moment.",
  '잠시 후 다시 시도해 주세요.': 'Please try again in a moment.',
  // T-11-146 번역 보기
  // i18n-ignore: 응답 문장을 찾는 한국어 원문 키
  '지금은 번역할 수 없어요. 잠시 후 다시 시도해 주세요.':
    "Translation isn't available right now. Please try again in a moment.",
  // i18n-ignore: 응답 문장을 찾는 한국어 원문 키
  '번역을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.':
    "You've asked for translations too often. Please try again in a moment.",
  '로그인을 마치지 못했어요.': "We couldn't finish signing you in.",
  '앱에서만 쓸 수 있어요.': 'This is only available in the app.',
  '새 프로필을 너무 자주 만들고 있어요. 잠시 뒤에 다시 시도해 주세요.':
    "You're creating profiles too often. Please try again shortly.",
  '로그인하면 닉네임을 정할 수 있어요.': 'Sign in to set a nickname.',
  '쓸 수 없는 닉네임이에요.': "That nickname isn't allowed.",
  '이미 쓰고 있는 닉네임이에요.': 'That nickname is already taken.',
  '복구를 너무 자주 시도했어요. 잠시 후 다시 시도해 주세요.':
    "You've tried to recover too many times. Please try again in a moment.",
  '복구 코드가 올바르지 않아요.': "That recovery code isn't right.",
  '복구 코드를 너무 자주 발급했어요. 잠시 후 다시 시도해 주세요.':
    "You've requested recovery codes too often. Please try again in a moment.",
  '삭제 확인 정보가 올바르지 않아요. 삭제 요청부터 다시 진행해 주세요.':
    "The deletion confirmation isn't valid. Please start the deletion again.",
  // 커리어 · 명예의 전당 · 신고
  '기록을 너무 자주 올리고 있어요. 잠시 뒤에 다시 시도해 주세요.':
    "You're uploading records too often. Please try again shortly.",
  '커리어를 찾을 수 없어요.': "We couldn't find that career.",
  '공개할 수 없는 이름이에요.': "That name can't be made public.",
  '시즌 기록이 있어야 은퇴를 기록할 수 있어요.': 'You need a season record to log a retirement.',
  '이 커리어는 다른 계정에 기록돼 있어요.': 'This career is saved under another account.',
  '명예의 전당에서 선수를 찾지 못했어요.': "We couldn't find that player in the Hall of Fame.",
  '신고할 이름을 찾지 못했어요.': "We couldn't find the name to report.",
  '내 이름은 신고할 수 없어요.': "You can't report your own name.",
  // 알림
  '앱에서 알림을 열어 주세요.': 'Open notifications in the app.',
  '변경할 알림 설정을 선택해 주세요.': 'Choose a notification setting to change.',
  '앱에서 알림을 설정해 주세요.': 'Set up notifications in the app.',
  '잠시 뒤 알림 설정을 다시 시도해 주세요.': 'Please try the notification settings again shortly.',
  '알림 테스트 준비 중이에요.': 'The notification test is being prepared.',
  '이 기기의 알림 받기를 먼저 켜 주세요.': 'Turn on notifications for this device first.',
  '이 기기의 알림을 다시 연결해 주세요.': 'Please reconnect notifications for this device.',
  '이 알림을 찾을 수 없어요.': "We couldn't find this notification.",
  '알림 요청 결과를 확인하지 못했어요. 기기에서 수신 여부를 확인해 주세요.':
    "We couldn't confirm the notification request. Check whether your device received it.",
  '알림 요청을 보내지 못했어요.': "We couldn't send the notification request.",
  '알림 요청 결과를 확인하지 못했어요.': "We couldn't confirm the notification request.",
  '알림 연결을 확인해 주세요.': 'Please check your notification connection.',
  '알림 접수 번호를 확인하지 못했어요.': "We couldn't confirm the notification receipt.",
  '오늘 테스트 알림을 3회 요청했어요. 내일 다시 보낼 수 있어요.':
    "You've requested 3 test notifications today. You can send another tomorrow.",
  '테스트 알림은 10분에 한 번 보낼 수 있어요.':
    'You can send a test notification once every 10 minutes.',
  // 채팅 · 게시판
  '채팅을 잠시 쓸 수 없어요.': "Chat isn't available right now.",
  '메시지를 찾을 수 없어요.': "We couldn't find that message.",
  '내 메시지는 신고하거나 차단할 수 없어요.': "You can't report or block your own message.",
  '운영자 메시지는 신고하거나 차단할 수 없어요.':
    "You can't report or block a moderator's message.",
  '쓸 수 없는 표현이 들어 있어요.': "That text contains words that aren't allowed.",
  '로그인하면 댓글을 쓸 수 있어요.': 'Sign in to comment.',
  '댓글에 쓸 닉네임을 먼저 정해 주세요.': 'Choose a nickname for your comments first.',
  '댓글을 너무 자주 쓰고 있어요. 잠시 뒤에 다시 시도해 주세요.':
    "You're commenting too often. Please try again shortly.",
  '내 댓글만 지울 수 있어요.': 'You can only delete your own comments.',
  '내 댓글은 신고하거나 차단할 수 없어요.': "You can't report or block your own comment.",
  '운영자는 차단할 수 없어요.': "You can't block a moderator.",
  // 팀 · 친구 · 친선전
  '팀을 찾을 수 없어요.': "We couldn't find that team.",
  '아직 열리지 않은 시즌이에요.': "That season isn't open yet.",
  '내 팀에는 좋아요를 누를 수 없어요.': "You can't like your own team.",
  '끝난 시즌의 팀에는 좋아요를 바꿀 수 없어요.':
    "You can't change likes on a team from a finished season.",
  '먼저 이번 시즌 팀을 만들어 주세요.': "Create this season's team first.",
  '로그인하면 팀을 만들 수 있어요.': 'Sign in to create a team.',
  '지금은 시즌 사이 휴식기예요. 다음 시즌이 열리면 새 팀을 꾸릴 수 있어요.':
    "It's the off-season. You can build a new team when the next season opens.",
  '한 선수는 한 자리에만 넣을 수 있어요.': 'A player can only fill one spot.',
  '이번 시즌에 뛰고 은퇴한 내 선수만 팀에 넣을 수 있어요.':
    'Only your players who played and retired this season can join your team.',
  '이 팀과는 오늘 이미 겨뤘어요. 한국 시각 자정에 다시 도전할 수 있어요.':
    "You've already played this team today. You can challenge them again at midnight KST.",
  '은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.':
    'Add at least one retired player to play a match.',
  '친구 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요.':
    "We couldn't find that friend code. Please check the code again.",
  '친구 신청을 너무 자주 보냈어요. 잠시 뒤에 다시 해 주세요.':
    "You're sending friend requests too often. Please try again shortly.",
  '내 코드예요. 친구의 코드를 넣어 주세요.': "That's your own code. Enter your friend's code.",
  '이 구단주에게는 친구 신청을 보낼 수 없어요.': "You can't send a friend request to this owner.",
  '상대의 친구 목록이 가득 찼어요.': "This owner's friend list is full.",
  '받은 친구 신청이 없어요.': "There's no friend request from this owner.",
  '친구에게만 친선전을 걸 수 있어요.': 'You can only challenge friends to a friendly.',
  '친구가 아직 이번 시즌 팀을 꾸리지 않았어요.': "Your friend hasn't built a team this season yet.",
  '지난 시즌 팀은 고칠 수 없어요.': "You can't edit a past season's team.",
  '지금 가진 내 선수만 팀에 넣을 수 있어요.': 'Only players you currently own can join your team.',
  '지금 가진 프리시즌 선수만 프리시즌 팀에 넣을 수 있어요.':
    'Only preseason players you currently own can join your preseason team.',
  '먼저 프리시즌 팀을 만들어 주세요.': 'Create your preseason team first.',
  '친구가 아직 프리시즌 팀을 꾸리지 않았어요.': "Your friend hasn't built a preseason team yet.",
  // 이적시장
  '지금은 시즌 사이 휴식기라 이적시장이 닫혀 있어요.':
    'The transfer market is closed during the off-season.',
  '이미 팔렸거나 내린 선수예요.': 'That player has already been sold or unlisted.',
  '구단 자금이 모자라요.': "You don't have enough club funds.",
  '내 선수 카드를 찾을 수 없어요.': "We couldn't find your player card.",
  '이번 시즌 선수만 내놓을 수 있어요.': "You can only list this season's players.",
  '기준가가 없는 선수는 내놓을 수 없어요.': "Players without a base value can't be listed.",
  '이미 내놓은 선수예요.': 'That player is already listed.',
  '판매가가 정할 수 있는 범위를 벗어났어요.': 'The asking price is outside the allowed range.',
  '이미 내놓았거나 방출했거나 잠근 선수예요.':
    'That player has already been listed, released or locked.',
  '잠긴 선수예요. 잠금을 풀어야 내놓을 수 있어요.':
    'This player is locked. Unlock them to list them.',
  '판매 중인 선수예요. 판매를 내린 뒤 잠글 수 있어요.':
    'This player is listed. Take the listing down to lock them.',
  '내가 내놓은 선수예요.': "That's your own listing.",
  '판매가가 바뀌었어요. 다시 확인해 주세요.': 'The price has changed. Please check it again.',
  '선발에 든 선수는 팀에서 뺀 뒤 방출해 주세요.':
    'Remove starters from your team before releasing them.',
  '방출할 수 있는 선수가 없어요.': 'There are no players you can release.',
};

/** 숫자·이름이 끼는 문장. */
const PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [
    /^친구는 신청 중인 사람을 포함해 (\d+)명까지예요\.$/,
    (m) => `You can have up to ${m[1]} friends, including pending requests.`,
  ],
  [
    /^오늘 친선전은 모두 치렀어요\(하루 (\d+)경기\)\. 한국 시각 자정에 다시 열려요\.$/,
    (m) => `You've played all of today's friendlies (${m[1]} a day). They reopen at midnight KST.`,
  ],
  [
    /^오늘 경기는 모두 치렀어요\(하루 (\d+)경기\)\. 한국 시각 자정에 다시 열려요\.$/,
    (m) => `You've played all of today's matches (${m[1]} a day). They reopen at midnight KST.`,
  ],
  [
    /^지난 시즌 선수는 선발에 (\d+)명까지 넣을 수 있어요\.$/,
    (m) => `You can start up to ${m[1]} players from past seasons.`,
  ],
  [
    /^한 번에 (\d+)명까지 내놓을 수 있어요\.$/,
    (m) => `You can list up to ${m[1]} players at a time.`,
  ],
  [
    /^오늘은 (\d+)명까지 영입할 수 있어요\. 내일 다시 영입해 주세요\.$/,
    (m) => `You can sign up to ${m[1]} players today. Try again tomorrow.`,
  ],
  [
    /^운영자 계정의 댓글 닉네임은 '(.+)'로 고정돼요\.$/,
    (m) => `A moderator account's comment nickname is fixed as '${m[1]}'.`,
  ],
  [
    /^'운영자'처럼 운영진으로 보이는 (닉네임|팀 이름|감독 이름|로고 글자)(?:은|는) 쓸 수 없어요\.$/,
    (m) => `A ${WHAT[m[1]!]} that looks like staff, such as 'Moderator', isn't allowed.`,
  ],
  [
    /^쓸 수 없는 (닉네임|팀 이름|감독 이름|로고 글자)이에요\.$/,
    (m) => `That ${WHAT[m[1]!]} isn't allowed.`,
  ],
  [/^(글|댓글|차단) 항목을 찾을 수 없어요\.$/, (m) => `We couldn't find that ${KIND[m[1]!]}.`],
];
const WHAT: Record<string, string> = {
  닉네임: 'nickname',
  '팀 이름': 'team name',
  '감독 이름': 'manager name',
  '로고 글자': 'logo text',
};
const KIND: Record<string, string> = { 글: 'post', 댓글: 'comment', 차단: 'block' };

const TABLES: Record<
  Exclude<Lang, 'ko'>,
  { exact: Record<string, string>; patterns: [RegExp, (m: RegExpExecArray) => string][] }
> = { en: { exact: EXACT, patterns: PATTERNS }, ja: { exact: EXACT_JA, patterns: PATTERNS_JA } };

/** 한국어 문장을 요청 언어로. 한국어면 그대로, 표에 없으면 한국어 그대로 돌려준다. */
export function localizeMessage(message: string, lang: Lang): string {
  if (lang === 'ko') return message;
  const T = TABLES[lang];
  const hit = T.exact[message];
  if (hit) return hit;
  for (const [re, make] of T.patterns) {
    const m = re.exec(message);
    if (m) return make(m);
  }
  return cupText(message, lang) ?? message;
}
