// 이적시장 시트(웹 sheets/Market.svelte): 다음 시즌 뛸 곳을 고른다. 선택은 pickOption이 이어서 처리한다.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { buzz, pickOption } from '../game/host';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { ClubBadge } from '../ui/ClubBadge';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function Market({ v }: { v: Extract<SheetView, { kind: 'market' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  return (
    <>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header">
        다음 시즌, 어디서 뛸까요?
      </Txt>
      <Txt tone="muted">{s.note}</Txt>
      {s.assessment ? (
        <Txt v="sm" testID="market-feedback">
          {s.assessment}
        </Txt>
      ) : null}
      <View style={{ gap: 10 }}>
        {s.options.map((o, i) => (
          <Press
            key={i}
            testID={`opt-${i}`}
            accessibilityLabel={`${o.name}, ${o.lg}${o.salary !== null ? `, 연봉 ${o.salary}` : ''}${o.sub ? `, ${o.sub}` : ''}${o.reason ? `, ${o.reason}` : ''}`}
            onPress={() => {
              buzz();
              pickOption(i);
            }}
            style={{
              borderWidth: 1.5,
              borderColor: c.line,
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: c.surface,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {o.clubId ? <ClubBadge club={{ id: o.clubId, name: o.name }} size={30} /> : null}
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontSize: rem(1), fontWeight: '700' }}>{o.name}</Txt>
                  <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                    {o.lg}
                  </Txt>
                </View>
              </View>
              {o.salary !== null ? (
                <View>
                  <Txt
                    style={{ fontFamily: DISPLAY[700], fontSize: rem(1.25), textAlign: 'right' }}
                  >
                    {o.salary}
                  </Txt>
                  <Txt tone="muted" style={{ fontSize: rem(0.75), textAlign: 'right' }}>
                    연봉
                  </Txt>
                </View>
              ) : null}
            </View>
            {o.sub ? (
              <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                {o.sub}
              </Txt>
            ) : null}
            {o.reason ? (
              <Txt v="sm" tone="muted" testID={`offer-feedback-${i}`}>
                {o.reason}
              </Txt>
            ) : null}
          </Press>
        ))}
      </View>
    </>
  );
}
