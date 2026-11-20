/**
 * T-11-779 상품 안내(은퇴 뒤 시즌 패스 안내 카드 · 광고 자리의 멤버십 안내 줄) 계측. 웹(gtag) · 앱(Firebase)이 같은 이름 · 값을 보낸다.
 * offer_hint_view(보임, 실행마다 곳별 한 번) · offer_hint_click(누름) · offer_hint_close(닫음 · 접음). 곳 이름만 보내고
 * 가격 · 계정 · 선수 정보는 싣지 않는다. 화면 · 이동에는 영향을 주지 않는다.
 */
export const OFFER_HINT_PLACES = ['pass_retired', 'member_attendance', 'member_boost'] as const;
export type OfferHintPlace = (typeof OFFER_HINT_PLACES)[number];
export type OfferHintAction = 'view' | 'click' | 'close';
/** click의 단계. open = 안내 줄을 눌러 혜택을 펼침(멤버십 안내), go = 상품 화면으로 감. */
export type OfferHintStep = 'open' | 'go';

type IO = {
  /** 지금 보낼 수 있는지(동의 · SDK 준비). 보낼 수 없을 때의 view는 '보냄'으로 적지 않아 준비된 뒤 다시 보일 때 나간다. */
  allowed: () => boolean;
  send: (name: string, params: Record<string, string>) => unknown;
};
export function createOfferHint(io: IO) {
  const seen = new Set<OfferHintPlace>();
  return (action: OfferHintAction, place: OfferHintPlace, step?: OfferHintStep) => {
    if (!OFFER_HINT_PLACES.includes(place)) return;
    if (action !== 'view' && action !== 'click' && action !== 'close') return;
    if (action === 'view') {
      if (!io.allowed() || seen.has(place)) return;
      seen.add(place);
    }
    const tagged = action === 'click' && (step === 'open' || step === 'go');
    io.send('offer_hint_' + action, { place, ...(tagged ? { step } : {}) });
  };
}
