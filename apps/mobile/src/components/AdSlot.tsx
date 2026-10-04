// T-11-068 앱 광고 칸(웹 ads/AdSlot.svelte). 위치 이름만 받고 노출 규칙은 app-core adPolicy가 정한다. 목록·페이지 맨 끝에만 둔다.
// 맞춤 광고 동의를 받지 않아 비개인화 광고만 요청한다(그래서 iOS 추적 동의 창도 띄우지 않는다). 개발 빌드는 구글 테스트 광고를 쓴다.
// EEA·영국·스위스는 AdMob 'OFFSIDE 유럽 동의' 메시지(UMP)를 첫 광고 칸에서 한 번 띄우고, 광고 요청은 그 뒤에 한다.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSnapshot } from 'valtio';
import { shouldShow, type AdPlace } from '@offside/app-core/adPolicy';
import { askConsent } from '../platform/adConsent';
import { adFree } from '../platform/adFree';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';

/** AdMob 배너 단위. 위치마다 나누지 않고 플랫폼별 하나를 같이 쓴다. */
const UNIT = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: 'ca-app-pub-3797087216173591/1505753355',
      android: 'ca-app-pub-3797087216173591/2033201114',
    });

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
  // 노출 여부는 마운트할 때 한 번 정한다 — 화면에 있는 동안 칸이 생기거나 사라지지 않게.
  const [phase, setPhase] = useState<'off' | 'consent' | 'ready'>(() =>
    claim(place) ? 'consent' : 'off',
  );
  // 적응형 배너는 기본이 기기 전체 폭이라 화면 여백만큼 밖으로 나간다. 칸 폭을 재서 넘긴다.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (phase !== 'consent') return;
    let alive = true;
    void askConsent().then((ok) => alive && setPhase(ok ? 'ready' : 'off'));
    return () => {
      alive = false;
    };
  }, [phase]);
  // T-11-069 광고 제거를 사면 보고 있던 칸도 바로 접는다.
  const { owned } = useSnapshot(adFree);
  if (phase === 'off' || owned || !UNIT) return null;
  return (
    <View
      accessibilityLabel="광고"
      testID={`ad-${place}`}
      style={{ marginTop: 24, gap: 6 }}
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
        광고
      </Txt>
      {phase === 'ready' && width > 0 && (
        <BannerAd
          unitId={UNIT}
          width={width}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={() => {
            lastShown.set(place, Infinity);
            setPhase('off');
          }}
        />
      )}
    </View>
  );
}
