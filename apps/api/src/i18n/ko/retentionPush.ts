// T-11-501 리텐션 푸시 문구(push/retention.ts). 알림함 · 푸시는 한국어로 저장하고 push/text.ts가 요청 언어로 바꾼다.
// {n}처럼 중괄호로 감싼 자리는 숫자만 들어간다(retentionText가 이 틀로 한국어 문장을 되읽어 다른 언어로 옮긴다).
// 보상 · 긴급성 · 손실을 암시하지 않는다(쉬는 사람에게 사실만 알린다).
export const retentionPushText = {
  career: {
    title: '이어 하던 선수가 있어요',
    body: '홈에서 이어 하기를 누르면 멈춘 곳부터 이어가요.',
  },
  matches: {
    title: '쉬는 동안 랭크 경기 {n}번을 치렀어요',
    body: '{w}승 {d}무 {l}패예요. 내 팀 최근 경기에서 결과를 볼 수 있어요.',
  },
  sold: {
    title: '쉬는 동안 선수 {n}명이 팔렸어요',
    body: '이적시장 내 거래에서 판매 내역과 구단 자금을 볼 수 있어요.',
  },
  season: {
    title: '새 시즌이 열렸어요',
    body: '시즌 {season} 순위가 처음부터 시작돼요.',
  },
  news: {
    title: '쉬는 동안 바뀐 것들이 있어요',
    body: '업데이트 소식에 새 기능을 모아 뒀어요.',
  },
  farewell: {
    title: '커리어는 그대로 남아 있어요',
    body: '언제든 홈에서 이어 하면 돼요. 이번 안내 뒤에는 따로 보내지 않아요.',
  },
  create: {
    title: '첫 선수를 만들 차례예요',
    body: '선수를 만들면 바로 데뷔 시즌이 시작돼요.',
  },
  retire: {
    title: '데뷔한 선수가 기다리고 있어요',
    body: '은퇴까지 마치면 선수 카드가 생기고 내 구단을 만들 수 있어요.',
  },
  login: {
    title: '은퇴한 선수로 구단을 만들 수 있어요',
    body: '구글이나 애플로 로그인하면 구단을 만들고 기기를 바꿔도 기록을 이어가요.',
  },
  club: {
    title: '은퇴한 선수 카드로 구단을 만들 차례예요',
    body: '구단을 만들면 다른 구단주와 랭크 경기를 해요.',
  },
  rank: {
    title: '첫 랭크 경기를 치를 차례예요',
    body: '내 팀에서 상대를 골라 경기를 시작해요.',
  },
} as const;
export type RetentionStory = keyof typeof retentionPushText;
