// 새 버전 알림(웹 UpdateBanner.svelte). 받아 둔 OTA 번들이 있으면 '다시 시작'으로 바로 적용한다.
import { useUpdates } from 'expo-updates';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { applyUpdate } from '../platform/updates';
import { Btn, Txt } from '../ui';
import { TopBanner } from './TopBanner';
import { useFly } from './useFly';

export function UpdateBanner() {
  const c = useColors();
  const { isUpdatePending } = useUpdates();
  const { mounted, style } = useFly(isUpdatePending, 200);
  if (!mounted) return null;
  return (
    <TopBanner testID="update-banner" label="업데이트 알림" style={style}>
      <Txt
        style={{ flex: 1, fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4, color: c.onPitch }}
      >
        새 버전이 나왔어요. 다시 시작하면 바로 적용돼요.
      </Txt>
      <Btn kind="accent" sm testID="reload" onPress={applyUpdate}>
        다시 시작
      </Btn>
    </TopBanner>
  );
}
