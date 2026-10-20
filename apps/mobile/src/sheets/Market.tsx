// 이적시장 시트(웹 sheets/Market.svelte): 다음 시즌 뛸 곳을 고른다. 선택은 pickOption이 이어서 처리한다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { careerMomentText as CM } from '@offside/app-core/i18n/ko/careerMoment';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
import { shellMoreText as SM } from '@offside/app-core/i18n/ko/shellMore';
import { canDismissSheet } from '@offside/app-core/sheet-controller';
import { buzz, dismissSheet, pickOption } from '../game/host';
import { appState, sheetState } from '../store';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { ClubBadge } from '../ui/ClubBadge';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function Market({ v }: { v: Extract<SheetView, { kind: 'market' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const sh = useSnapshot(sheetState);
  const { G } = useSnapshot(appState);
  const closable = canDismissSheet(
    { busy: sh.busy, view: sheetState.view },
    G?.pending as Parameters<typeof canDismissSheet>[1],
  );
  return (
    <>
      <View style={{ gap: 14 }}>
        <Txt v="eyebrow">{s.eyebrow}</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ paddingRight: 40 }}>
          {L.marketTitle}
        </Txt>
        {/* 계약서(Contract.tsx sign-close)와 같은 자리·모양의 닫기. 저장된 제안은 그대로 남는다. */}
        {closable ? (
          <Press
            testID="market-close"
            accessibilityLabel={SM.close}
            onPress={() => dismissSheet()}
            style={{
              position: 'absolute',
              top: -6,
              right: -4,
              width: 44,
              height: 44,
              borderRadius: RADIUS.lg,
              backgroundColor: c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt tone="muted" style={{ fontSize: rem(FONT.title2), lineHeight: rem(FONT.title2) }}>
              ×
            </Txt>
          </Press>
        ) : null}
      </View>
      <Txt tone="muted">{s.note}</Txt>
      {s.assessment ? (
        <Txt v="sm" testID="market-feedback">
          {s.assessment}
        </Txt>
      ) : null}
      <Txt v="sm" tone="muted">
        {L.marketHint}
      </Txt>
      {s.options.some((o) => o.destination) ? (
        <Txt v="xs" tone="muted">
          {CM.estimateNote}
        </Txt>
      ) : null}
      <View style={{ gap: 10 }}>
        {s.options.map((o, i) => (
          <Press
            key={i}
            testID={`opt-${i}`}
            accessibilityLabel={L.offerA11y({
              name: o.name,
              lg: o.lg,
              salary: o.salary,
              sub: [o.sub, o.destination].filter(Boolean).join(' · ') || null,
              reason: o.reason,
            })}
            onPress={() => {
              buzz();
              pickOption(i);
            }}
            style={{
              borderWidth: 1.5,
              borderColor: 'transparent',
              borderRadius: RADIUS.md,
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: c.surface2,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {o.clubId ? <ClubBadge club={{ id: o.clubId, name: o.name }} size={30} /> : null}
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontSize: rem(FONT.body), fontWeight: '700' }}>{o.name}</Txt>
                  <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                    {o.lg}
                  </Txt>
                </View>
              </View>
              {o.salary !== null ? (
                <View>
                  <Txt
                    style={{
                      fontFamily: DISPLAY[700],
                      fontSize: rem(FONT.title2),
                      textAlign: 'right',
                    }}
                  >
                    {o.salary}
                  </Txt>
                  <Txt tone="muted" style={{ fontSize: rem(FONT.caption), textAlign: 'right' }}>
                    {L.salary}
                  </Txt>
                </View>
              ) : null}
              <Txt accessibilityElementsHidden tone="muted" style={{ fontSize: rem(FONT.title1) }}>
                ›
              </Txt>
            </View>
            {o.sub ? (
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                {o.sub}
              </Txt>
            ) : null}
            {o.destination ? (
              <Txt v="sm" tone="muted" testID={`transfer-outlook-${i}`}>
                {o.destination}
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
