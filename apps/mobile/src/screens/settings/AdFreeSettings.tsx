// T-11-069 광고 제거 구매·복원. 앱에만 있다(웹 광고는 그대로).
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { SUPPORTED, adFree, buyAdFree, restoreAdFree } from '../../platform/adFree';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';
import { adText as L } from '@offside/app-core/i18n/ko/ad';

export function AdFreeSettings() {
  const s = useSnapshot(adFree);
  if (!SUPPORTED) return null;
  return (
    <SettingsCard gap={12}>
      <SettingsLabel eyebrow="Ads" title={L.title} muted={L.body} />
      {s.owned ? (
        <Txt testID="ad-free-owned">{L.owned}</Txt>
      ) : (
        <View style={{ gap: 8 }}>
          <Btn block disabled={s.busy} testID="ad-free-buy" onPress={() => void buyAdFree()}>
            {s.busy ? L.checking : s.price ? L.buyPrice({ price: s.price }) : L.title}
          </Btn>
          <Btn
            block
            disabled={s.busy}
            testID="ad-free-restore"
            onPress={() => void restoreAdFree()}
          >
            {L.restore}
          </Btn>
        </View>
      )}
      {s.message ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {s.message}
        </Txt>
      ) : null}
    </SettingsCard>
  );
}
