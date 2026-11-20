// T-11-770d 첫 구매 묶음 카드(기획 T-11-747 R2). 상점 맨 위(place="shop")와 끝까지 뛴 선수가 은퇴한 화면(place="retired")에 둔다.
// 서버가 살 수 있다고 하고 스토어 가격을 받았을 때만 보인다. 가격은 스토어가 준 현지 가격을 그대로 쓰고, 정가 대비 할인율은
// 적지 않는다(나라마다 낱개 가격이 달라 맞지 않을 수 있다).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { rewardText } from '@offside/app-core/attendance-view';
import { onRetirementSynced } from '@offside/app-core/outbox';
import { iapText as IL } from '@offside/app-core/i18n/ko/iap';
import { starterPackText as L } from '@offside/app-core/i18n/ko/starterPack';
import {
  buyStarterPack,
  starterPackOpen,
  starterPackStore,
  syncStarterPack,
} from '../../platform/starterPack';
import { Btn } from '../../ui';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';

export function StarterPackCard({ place }: { place: 'shop' | 'retired' }) {
  const s = useSnapshot(starterPackStore);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    void syncStarterPack();
    // 은퇴 화면에서는 이 은퇴가 서버에 올라간 뒤에야 자격이 생길 수 있어, 올라갈 때 한 번 더 묻는다.
    return place === 'retired' ? onRetirementSynced(() => void syncStarterPack(true)) : undefined;
  }, [place]);
  if (closed || !starterPackOpen(s) || !s.pack) return null;
  return (
    <Card gap={12} testID={`starter-pack-${place}`}>
      <View>
        <Txt v="eyebrow">Starter pack</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.title}
        </Txt>
      </View>
      <Txt testID="starter-pack-items">{rewardText(s.pack.items)}</Txt>
      <Txt v="sm" tone="muted">
        {L.note}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn
          kind="accent"
          testID="starter-pack-buy"
          disabled={s.busy}
          onPress={() => void buyStarterPack()}
        >
          {s.busy ? IL.busy : L.buy({ price: s.price! })}
        </Btn>
        {place === 'retired' ? (
          <Btn kind="ghost" testID="starter-pack-close" onPress={() => setClosed(true)}>
            {L.close}
          </Btn>
        ) : null}
      </View>
    </Card>
  );
}
