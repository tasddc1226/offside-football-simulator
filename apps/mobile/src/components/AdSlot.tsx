// T-11-068 앱 광고 칸(웹 ads/AdSlot.svelte). 위치 이름만 받고 노출 규칙은 app-core adPolicy가 정한다. 승인된 위치에 본문과 함께 스크롤되는 칸을 둔다.
// T-11-159 AppLovin MAX 배너(AdMob·Meta 입찰). 비개인화 광고만 받고, 첫 광고 칸에서 SDK를 시작한 뒤 요청한다(platform/ads).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AdFormat, AdView } from 'react-native-applovin-max';
import { useSnapshot } from 'valtio';
import { shouldShow, type AdPlace } from '@offside/app-core/adPolicy';
import { startAds, unitOf } from '../platform/ads';
import { adFree } from '../platform/adFree';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

/** 배너 단위. 위치마다 나누지 않고 플랫폼별 하나를 같이 쓴다. */
const UNIT = unitOf('banner');

// 위치별 마지막 요청 시각. 안 채워진 위치는 Infinity로 둬 이 세션에서 다시 요청하지 않는다.
const lastShown = new Map<AdPlace, number>();

/** 이 위치에 지금 칸을 둘지 정하고, 두면 요청 시각을 남긴다. */
function claim(place: AdPlace) {
  const now = Date.now();
  if (!UNIT || adFree.owned || !shouldShow(place, now, lastShown.get(place))) return false;
  lastShown.set(place, now);
  return true;
}

export function AdSlot({ place }: { place: AdPlace }) {
  const owner = place === 'owner-summary';
  // 노출 여부는 마운트할 때 한 번 정한다 — 화면에 있는 동안 칸이 생기거나 사라지지 않게.
  const [phase, setPhase] = useState<'off' | 'starting' | 'ready'>(() =>
    claim(place) ? 'starting' : 'off',
  );
  // 적응형 배너는 기본이 기기 전체 폭이라 화면 여백만큼 밖으로 나간다. 칸 폭을 재서 넘긴다.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (phase !== 'starting') return;
    let alive = true;
    void startAds().then((ok) => alive && setPhase(ok ? 'ready' : 'off'));
    return () => {
      alive = false;
    };
  }, [phase]);
  // T-11-069 광고 제거를 사면 보고 있던 칸도 바로 접는다.
  const { owned } = useSnapshot(adFree);
  if (phase === 'off' || owned || !UNIT) return null;
  const banner = phase === 'ready' && width > 0 && (
    <AdView
      adUnitId={UNIT}
      adFormat={AdFormat.BANNER}
      style={{ width }}
      onAdLoadFailed={() => {
        lastShown.set(place, Infinity);
        setPhase('off');
      }}
    />
  );
  return (
    <View
      accessibilityLabel={shellMoreText.adLabel}
      testID={`ad-${place}`}
      style={{ marginTop: owner ? 8 : 24, marginBottom: owner ? 12 : 0, gap: 6 }}
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.6875), ...(owner ? { lineHeight: 14 } : {}) }}>
        {shellMoreText.adLabel}
      </Txt>
      {/* 적응형 배너의 SDK 최소 높이(50)만 예약한다. height/maxHeight/overflow 제한 없이
          SDK가 알려 준 실제 높이로 커지므로 큰 광고도 자르지 않는다. 기존 하단 칸은 예약하지 않는다. */}
      {owner ? <View style={{ minHeight: 50 }}>{banner}</View> : banner}
    </View>
  );
}
