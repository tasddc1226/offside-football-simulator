// T-11-442 상점(리롤권 · 프리미엄 스카우트권)에서 구단 자금이 모자랄 때 — 얼마나 모자라는지와, 자금을 만드는 이적시장 방출
// 화면으로 가는 버튼(웹 cup/FundsShort.svelte).
import { FONT } from '@offside/app-core/design-tokens';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { View } from 'react-native';
import { goMarketRelease } from '../../game/nav';
import { rem } from '../../theme/type';
import { Btn, Txt } from '../../ui';

export function FundsShort({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View testID="funds-short" style={{ gap: 6 }}>
      <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
        {text}
      </Txt>
      <Btn
        sm
        testID="funds-go-release"
        style={{ alignSelf: 'flex-start' }}
        onPress={goMarketRelease}
      >
        {L.shopGoRelease}
      </Btn>
    </View>
  );
}
