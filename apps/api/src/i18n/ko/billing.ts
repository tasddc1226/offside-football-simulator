export const billing = {
  kinds: {
    purchase: '💳 새 구매',
    renewal: '🔄 구독 갱신',
    refund: '↩️ 환불',
    test: '🧪 연결 테스트',
  },
  // T-11-471 웹 결제(엑솔라)는 제목부터 앱 인앱 결제와 갈라 보인다.
  webKinds: {
    purchase: '🌐 웹 결제',
    refund: '↩️ 웹 결제 환불',
  },
  channel: '결제 경로',
  channels: { app: '앱 인앱 결제', web: '웹 결제 (offside-lab.com)' },
  live: '실결제',
  sandbox: '테스트 · Sandbox',
  product: '상품',
  store: '스토어',
  received: '알림 수신',
  timezone: '한국 시간',
  reference: '알림 참조',
  productId: '상품 ID',
  testNotice: '테스트 알림입니다. 실제 매출에 포함하지 마세요.',
  testProduct: '스토어 알림 연결 확인',
  removeAds: '광고 제거',
  seasonPass: '시즌 패스',
  items: {
    reroll: '리롤권',
    boost: '잠재력 강화권',
    scout: '프리미엄 스카우트권',
    rename: '선수 이름 변경권',
  },
  quantity: (name: string, qty: number) => `${name} ${qty}장`,
};
