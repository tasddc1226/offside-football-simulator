// T-11-390 구간 중계가 멈추고 뜨는 결정적 장면 카드(웹 sheets/KeyMoment.svelte). 선택지를 고르거나 15초가 지나면 감독에게 맡긴다.
import { View } from 'react-native';
import type { Snapshot } from 'valtio';
import type { MomentView } from '@offside/app-core/sheets';
import { keyMomentText as K } from '@offside/app-core/i18n/ko/keyMoment';
import { buzz } from '../game/host';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Btn } from '../ui/Btn';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function KeyMoment({
  m,
  choose,
}: {
  m: Snapshot<MomentView>;
  choose: (id: string) => void;
}) {
  const c = useColors();
  const tone = m.kind === 'crisis' ? c.bad : c.good;
  return (
    <View
      testID="key-moment"
      accessibilityLabel={m.title}
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tone,
        backgroundColor: c.surface2,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.125), color: tone }}>{m.title}</Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.8125), flexShrink: 1, textAlign: 'right' }}>
          {m.head}
        </Txt>
      </View>
      <Txt style={{ lineHeight: rem(1) * 1.5 }}>{m.scene}</Txt>
      {m.result ? (
        <View style={{ gap: 4 }} testID={`key-moment-result-${m.result.ok ? 'ok' : 'fail'}`}>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {m.result.picked}
          </Txt>
          <Txt
            accessibilityLiveRegion="polite"
            style={{
              fontWeight: '700',
              fontSize: rem(1.0625),
              color: m.result.ok ? c.good : c.bad,
            }}
          >
            {m.result.text}
          </Txt>
        </View>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            {m.choices.map((ch) => (
              <Press
                key={ch.id}
                testID={`key-moment-choice-${ch.id}`}
                accessibilityLabel={`${ch.label}, ${K.pct({ p: ch.pct })}, ${K.attr({ attr: ch.attr })}`}
                onPress={() => {
                  buzz();
                  choose(ch.id);
                }}
                style={{
                  minHeight: 48,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.surface,
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  gap: 2,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Txt style={{ flex: 1, fontWeight: '700' }}>{ch.label}</Txt>
                  <Txt
                    style={{
                      fontFamily: DISPLAY[700],
                      fontSize: rem(1.125),
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {K.pct({ p: ch.pct })}
                  </Txt>
                </View>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {K.attr({ attr: ch.attr })}
                </Txt>
              </Press>
            ))}
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${(m.left / m.secs) * 100}%`,
                backgroundColor: c.good,
              }}
            />
          </View>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {K.timer({ n: m.left })}
          </Txt>
          <Btn
            testID="key-moment-auto"
            onPress={() => choose('auto')}
            style={{ alignSelf: 'center' }}
          >
            {`${K.auto} · ${K.pct({ p: m.auto })}`}
          </Btn>
        </>
      )}
    </View>
  );
}
