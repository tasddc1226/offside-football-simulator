// 1.0.2 호환 번들: 이 빌드에는 AdMob 네이티브 모듈이 없어 광고 칸을 두지 않는다.
import type { AdPlace } from '@offside/app-core/adPolicy';

export function AdSlot(_: { place: AdPlace }) {
  return null;
}
