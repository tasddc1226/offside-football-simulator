import { iapText as L } from '@offside/app-core/i18n/ko/iap';
import { useIapItems } from '../../platform/iapItems';
import { Card, Txt } from '../../ui';
import { IapPacks } from './IapPacks';
export function PhysiqueShop() {
  const iap = useIapItems(true);
  const have = iap.items?.physique;
  return have === undefined ? null : (
    <Card gap={12}>
      <Txt v="h2">{L.physiqueTitle}</Txt>
      <Txt>{L.physiqueNote}</Txt>
      <Txt>
        {L.physiqueHave} · {have}
      </Txt>
      <IapPacks item="physique" />
    </Card>
  );
}
