// T-11-355 처음 안내 카드(웹 FirstGuide.svelte) — 포지션·유형, 스카우트권 위치, 영구결번처럼 자주 묻는 길찾기를
// 홈에서 한 번 알려 준다. 기기마다 닫을 때까지(app-core firstGuide).
import { useState } from 'react';
import { View } from 'react-native';
import { FOCUS_PICK } from '@offside/game/data';
import { closeGuide, guideOpen } from '@offside/app-core/firstGuide';
import { firstGuideText as L } from '@offside/app-core/i18n/ko/firstGuide';
import { goRerollShop, goTypeDex } from '../../game/nav';
import { openWeb } from '../../platform/openWeb';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';

export function FirstGuide() {
  const c = useColors();
  const [open, setOpen] = useState(() => guideOpen('home'));
  if (!open) return null;
  const close = () => {
    closeGuide('home');
    setOpen(false);
  };
  const rows = [
    {
      id: 'types',
      title: L.typesTitle,
      body: L.typesBody({ n: FOCUS_PICK }),
      go: L.typesGo,
      onPress: goTypeDex,
    },
    { id: 'shop', title: L.shopTitle, body: L.shopBody, go: L.shopGo, onPress: goRerollShop },
    {
      id: 'guide',
      title: L.guideTitle,
      body: L.guideBody,
      go: L.guideGo,
      onPress: () => openWeb('/guide/'),
    },
  ];
  return (
    <Card testID="first-guide" gap={12}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="eyebrow">Start here</Txt>
          <Txt bold accessibilityRole="header">
            {L.title}
          </Txt>
        </View>
        <Btn
          sm
          kind="ghost"
          testID="first-guide-close"
          accessibilityLabel={L.closeAria}
          onPress={close}
        >
          {L.close}
        </Btn>
      </View>
      {rows.map((r) => (
        <View
          key={r.id}
          style={{
            gap: 6,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: c.line,
            alignItems: 'flex-start',
          }}
        >
          <Txt bold>{r.title}</Txt>
          <Txt v="sm" tone="muted">
            {r.body}
          </Txt>
          <Btn sm testID={`first-guide-${r.id}`} onPress={r.onPress}>
            {r.go}
          </Btn>
        </View>
      ))}
    </Card>
  );
}
