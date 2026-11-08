/**
 * 구매 묶음 자리의 실제 노출 판정(commerceStage offer_view). 마운트 · 펼침이 아니라 화면 안에 ratio(기본 절반) 이상 보일 때
 * 자리마다 한 번만 onShown을 부른다. 잴 수 없으면(관찰자 · 스크롤 창 없음) 부르지 않는다. onShown이 던져도 화면에 닿지 않는다.
 */
export const OFFER_VIEW_RATIO = 0.5;

type Entry = { isIntersecting: boolean; intersectionRatio: number };
type ObserverCtor = new (
  cb: (entries: Entry[]) => void,
  init?: { threshold?: number | number[] },
) => { observe(node: never): void; disconnect(): void };

/**
 * 웹: IntersectionObserver. threshold만으로는 첫 콜백이 1%에서도 isIntersecting=true로 올 수 있어 intersectionRatio를
 * 직접 본다. ready()가 false(결제 중 막힌 버튼)인 순간은 세지 않는다. 돌려준 함수로 관찰을 끝내고, 그 뒤에 이미 줄에 올라
 * 있던 콜백이 와도(사라진 묶음) 세지 않는다.
 */
export function observeOfferView(
  node: unknown,
  o: { IO: ObserverCtor | undefined; ready: () => boolean; onShown: () => void; ratio?: number },
): () => void {
  const ratio = o.ratio ?? OFFER_VIEW_RATIO;
  if (!o.IO) return () => {};
  let seen = false;
  let live = true;
  let io: InstanceType<ObserverCtor> | undefined;
  try {
    io = new o.IO(
      (entries) => {
        if (!live || seen || !o.ready()) return;
        if (!entries.some((e) => e.isIntersecting && e.intersectionRatio >= ratio)) return;
        seen = true;
        io?.disconnect();
        try {
          o.onShown();
        } catch {
          /* 계측은 화면에 영향을 주지 않는다. */
        }
      },
      { threshold: ratio },
    );
    io.observe(node as never);
  } catch {
    return () => {};
  }
  return () => {
    live = false;
    io?.disconnect();
  };
}

/**
 * 앱: 지금 화면 스크롤 창 기준으로 잰 보이는 비율(ui/scroll measureShown). 스크롤 · 배치가 바뀔 때 check()를 다시 부른다.
 * stop() 뒤에 늦게 온 측정은 버린다.
 */
export function watchMeasuredShown(o: {
  measure: (cb: (share: number) => void) => void;
  subscribe: (fn: () => void) => () => void;
  onShown: () => void;
  ratio?: number;
}): { check: () => void; stop: () => void } {
  const ratio = o.ratio ?? OFFER_VIEW_RATIO;
  let live = true;
  let off = () => {};
  const stop = () => {
    live = false;
    off();
  };
  const check = () => {
    if (!live) return;
    try {
      o.measure((share) => {
        if (!live || !(share >= ratio)) return;
        stop();
        try {
          o.onShown();
        } catch {
          /* 계측은 화면에 영향을 주지 않는다. */
        }
      });
    } catch {
      /* 잴 수 없으면 세지 않는다. */
    }
  };
  off = o.subscribe(check);
  return { check, stop };
}
