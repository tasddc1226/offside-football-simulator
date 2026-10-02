// T-11-042 스토어 업데이트 안내. 서버가 알려 준 최소 버전보다 이 앱이 낮으면(새 시즌 빌드가 나왔다) 화면 위에 띄운다.
// 닫으면 이번 실행 동안만 숨긴다 — 다음에 켜면 다시 보인다.
import { View } from 'react-native';
import { openStore, useStoreUpdateShown } from '../platform/storeUpdate';
import { storeUpdate } from '../store';
import { alpha } from '../theme/colors';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Btn, Press, Txt } from '../ui';
import { TopBanner } from './TopBanner';
import { useFly } from './useFly';

export function StoreUpdateBanner() {
  const c = useColors();
  const { mounted, style } = useFly(useStoreUpdateShown(), 200);
  if (!mounted) return null;
  return (
    <TopBanner testID="store-update-banner" label="앱 업데이트 알림" style={style}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt bold style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4, color: c.onPitch }}>
          새 버전이 스토어에 나왔어요
        </Txt>
        <Txt
          style={{
            fontSize: rem(0.8125),
            lineHeight: rem(0.8125) * 1.4,
            color: alpha(c.onPitch, 0.85),
          }}
        >
          업데이트해야 앞으로의 개선을 계속 받을 수 있어요.
        </Txt>
      </View>
      <Btn kind="accent" sm testID="store-update-open" onPress={openStore}>
        업데이트
      </Btn>
      <Press
        testID="store-update-close"
        accessibilityLabel="알림 닫기"
        onPress={() => (storeUpdate.closed = true)}
        hitSlop={4}
        style={{
          width: 36,
          height: 36,
          marginLeft: -4,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt style={{ fontSize: rem(1), color: c.onPitch }}>✕</Txt>
      </Press>
    </TopBanner>
  );
}
