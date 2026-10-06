// 새 버전 알림(웹 UpdateBanner.svelte). 받아 둔 OTA 번들이 있으면 '다시 시작'으로 바로 적용한다.
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { applyUpdate } from '../platform/updates';
import { Btn, Txt } from '../ui';
import { TopBanner } from './TopBanner';
import { useFly } from './useFly';
import { useTopBanner } from './useTopBanner';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

export function UpdateBanner() {
  const c = useColors();
  const { mounted, style } = useFly(useTopBanner() === 'update', 200);
  if (!mounted) return null;
  return (
    <TopBanner testID="update-banner" label={L.updateAlert} style={style}>
      <Txt
        style={{ flex: 1, fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4, color: c.onPitch }}
      >
        {shellMoreText.updateBodyApp}
      </Txt>
      <Btn kind="accent" sm testID="reload" onPress={applyUpdate}>
        {shellMoreText.updateBtnApp}
      </Btn>
    </TopBanner>
  );
}
