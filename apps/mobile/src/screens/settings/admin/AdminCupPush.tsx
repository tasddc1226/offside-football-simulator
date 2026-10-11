import { useState } from 'react';
import { View } from 'react-native';
import type { PushPerformance } from '@offside/contracts';
import {
  cupPushText as L,
  CUP_AUDIENCE_METRICS,
  CUP_DELIVERY_METRICS,
  pushClickRate,
} from '@offside/app-core/pushPerformance';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { Txt } from '../../../ui/Txt';
import { Press } from '../../../ui/Press';
import { useColors } from '../../../theme/useColors';

type Cup = NonNullable<PushPerformance['cups']>[number];
function CupRow({ item }: { item: Cup }) {
  const [expanded, setExpanded] = useState(false);
  const c = useColors();
  const title =
    item.season !== null && item.edition !== null
      ? L.cupName({ season: item.season, edition: item.edition })
      : item.title;
  const metrics = (
    keys: readonly (
      (typeof CUP_AUDIENCE_METRICS)[number] | (typeof CUP_DELIVERY_METRICS)[number]
    )[],
  ) =>
    keys.map((key) => (
      <View
        key={key}
        style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}
      >
        <Txt tone="muted" style={{ flexShrink: 1, lineHeight: undefined }}>
          {L[key]}
        </Txt>
        <Txt bold style={{ lineHeight: undefined }}>
          {item[key].toLocaleString()}
        </Txt>
      </View>
    ));
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${expanded ? L.collapse : L.expand}`}
        accessibilityState={{ expanded }}
        testID={`cup-push-${item.cupId}`}
        onPress={() => setExpanded(!expanded)}
        style={{ minHeight: 48, paddingVertical: 14, gap: 8 }}
      >
        <Txt bold style={{ lineHeight: undefined }}>
          {title}
        </Txt>
        <Txt v="sm" tone="muted" style={{ lineHeight: undefined }}>
          {kst(item.createdAt)}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Txt v="sm" style={{ lineHeight: undefined }}>
            {L.recipients} {item.recipients.toLocaleString()}
          </Txt>
          <Txt v="sm" style={{ lineHeight: undefined }}>
            {L.acceptedRecipients} {item.acceptedRecipients.toLocaleString()}
          </Txt>
          <Txt v="sm" style={{ lineHeight: undefined }}>
            {L.clickRate} {pushClickRate(item)}
          </Txt>
        </View>
        <Txt v="sm" tone="muted">
          {expanded ? L.collapse : L.expand}
        </Txt>
      </Press>
      {expanded ? (
        <View style={{ gap: 12, paddingBottom: 12 }}>
          {metrics(CUP_AUDIENCE_METRICS)}
          <Txt v="sm" tone="muted" style={{ lineHeight: undefined }}>
            {L.dedupeHelp}
          </Txt>
          <Txt v="sm" tone="muted" style={{ lineHeight: undefined }}>
            {L.notQueuedHelp}
          </Txt>
          <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12, gap: 12 }}>
            {metrics(CUP_DELIVERY_METRICS)}
          </View>
        </View>
      ) : null}
    </View>
  );
}
export default function AdminCupPush({ items = [] }: { items?: PushPerformance['cups'] }) {
  const c = useColors();
  return (
    <View
      testID="cup-push-performance"
      style={{ gap: 12, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16 }}
    >
      <Txt v="h3" accessibilityRole="header">
        {L.title}
      </Txt>
      <Txt v="sm" tone="muted" style={{ lineHeight: undefined }}>
        {L.policy}
      </Txt>
      {items.length ? (
        items.map((item) => <CupRow key={item.cupId} item={item} />)
      ) : (
        <Txt tone="muted" style={{ lineHeight: undefined }}>
          {L.empty}
        </Txt>
      )}
      <Txt v="sm" tone="muted" style={{ lineHeight: undefined }}>
        {L.help}
      </Txt>
    </View>
  );
}
