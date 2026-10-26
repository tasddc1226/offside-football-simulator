// T-11-486a 광고 이용 요약. 보상형 광고로 받은 보상 · 광고 제거로 광고 없이 받은 보상 · 은퇴 전면광고를 이 기기에서 세어 두고,
// 다음 시즌 업로드에 실어 보낸 뒤 0부터 다시 센다(새 요청 없이 기존 업로드에 얹는다). 광고 제거 범위를 나눌지 정하는 관찰용이다.
import type { AdUsage } from '@offside/contracts';
import { kv } from './setup';
import { adFree } from './adFree';

const KEY = 'offside_ad_usage';
export type AdUsagePlacement = 'candidates' | 'peek' | 'boost';
const SHORT = { candidates: 'c', peek: 'p', boost: 'b' } as const;

type Counts = Omit<AdUsage, 'af'>;
const empty = (): Counts => ({ rw: { c: 0, p: 0, b: 0 }, fr: { c: 0, p: 0, b: 0 }, it: 0 });

function read(): Counts {
  try {
    const raw = kv.getString(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as Counts;
    return { rw: { ...empty().rw, ...v.rw }, fr: { ...empty().fr, ...v.fr }, it: v.it ?? 0 };
  } catch {
    return empty();
  }
}

function bump(change: (c: Counts) => void) {
  const c = read();
  change(c);
  kv.set(KEY, JSON.stringify(c));
}

/** 보상을 받았을 때. free는 광고 제거 구매자가 광고 없이 받은 경우. */
export function countReward(p: AdUsagePlacement, free: boolean) {
  bump((c) => {
    c[free ? 'fr' : 'rw'][SHORT[p]]++;
  });
}

/** 은퇴 전면광고를 띄웠을 때. */
export function countInterstitial() {
  bump((c) => {
    c.it++;
  });
}

/** 업로드에 실을 요약을 꺼내고 0부터 다시 센다. 센 것이 없어도 광고 제거 여부는 싣는다. */
export function takeAdUsage(): AdUsage {
  const c = read();
  kv.remove(KEY);
  return { af: adFree.owned, ...c };
}
