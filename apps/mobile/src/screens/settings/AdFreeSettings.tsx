// T-11-069 광고 제거 구매·복원. 앱에만 있다(웹 광고는 그대로).
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { SUPPORTED, adFree, buyAdFree, restoreAdFree } from '../../platform/adFree';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';

export function AdFreeSettings() {
  const s = useSnapshot(adFree);
  if (!SUPPORTED) return null;
  return (
    <SettingsCard gap={12}>
      <SettingsLabel
        eyebrow="Ads"
        title="광고 제거"
        muted="기록실·소식·레전드 맨 아래 광고를 영구히 꺼요. 같은 스토어 계정의 다른 기기에서도 구매를 복원할 수 있어요."
      />
      {s.owned ? (
        <Txt testID="ad-free-owned">광고 제거를 구매했어요. 고마워요.</Txt>
      ) : (
        <View style={{ gap: 8 }}>
          <Btn block disabled={s.busy} testID="ad-free-buy" onPress={() => void buyAdFree()}>
            {s.busy ? '스토어 확인 중…' : s.price ? `광고 제거 ${s.price}` : '광고 제거'}
          </Btn>
          <Btn
            block
            disabled={s.busy}
            testID="ad-free-restore"
            onPress={() => void restoreAdFree()}
          >
            구매 복원
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
