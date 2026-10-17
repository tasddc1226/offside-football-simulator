// T-11-355 상품 위치 안내(웹 ItemsHint.svelte) — 설정과 선수 만들기 후보 단계에서 "스카우트권·강화권은 여기서"를 한 번
// 알려 준다. 한쪽에서 닫으면 두 곳 모두 그 기기에서 다시 뜨지 않는다(app-core firstGuide 'items').
import { useState } from 'react';
import { View } from 'react-native';
import { closeGuide, guideOpen } from '@offside/app-core/firstGuide';
import { firstGuideText as L } from '@offside/app-core/i18n/ko/firstGuide';
import { goRerollShop } from '../game/nav';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { Btn, Card, Txt } from '../ui';

export function ItemsHint() {
  const c = useColors();
  const [open, setOpen] = useState(() => guideOpen('items'));
  if (!open) return null;
  const close = () => {
    closeGuide('items');
    setOpen(false);
  };
  return (
    <Card
      testID="items-hint"
      gap={12}
      style={{ flexDirection: 'row', borderWidth: 1, borderColor: alpha(c.accent, 0.45) }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' }}>
        <Txt bold>{L.itemsTitle}</Txt>
        <Txt v="sm" tone="muted">
          {L.itemsBody}
        </Txt>
        <Btn sm testID="items-hint-shop" onPress={goRerollShop}>
          {L.shopGo}
        </Btn>
      </View>
      <View>
        <Btn
          sm
          kind="ghost"
          testID="items-hint-close"
          accessibilityLabel={L.itemsCloseAria}
          onPress={close}
        >
          {L.close}
        </Btn>
      </View>
    </Card>
  );
}
