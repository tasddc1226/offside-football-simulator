// 이벤트 선택 시트(웹 sheets/EventChoice.svelte): 스토리 표시 · 눈썹 · 제목 · 본문 · 선택지(확률 · 득실 칩 표시).
// T-11-432 득실 칩을 버튼 안에 그린다. T-11-438 '안전' · '원터치' 뜻은 선택지 아래 한 줄씩(legend) 늘 보인다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import type { PeekChip } from '@offside/app-core/eventPeek';
import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
import { buzz, chooseEvent } from '../game/host';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { mixColor } from './parts';

export function EventChoice({ v }: { v: Extract<SheetView, { kind: 'event' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  return (
    <>
      {s.story ? (
        <View
          style={{
            alignSelf: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: RADIUS.pill,
            backgroundColor: mixColor(c.accent, c.surface, 16),
            borderWidth: 1,
            borderColor: alpha(c.accent, 0.55),
          }}
        >
          <Txt style={{ fontSize: rem(FONT.caption), fontWeight: '600' }}>
            {`${L.storyTag({ name: s.story.name })} `}
            <Txt
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(FONT.body2),
                color: c.accent,
              }}
            >{`${s.story.stage}/${s.story.total}`}</Txt>
          </Txt>
        </View>
      ) : null}
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.title}
      </Txt>
      <Txt>{s.text}</Txt>
      <View style={{ gap: 10 }}>
        {s.choices.map((ch, i) => (
          <Press
            key={i}
            testID={`choice-${i}`}
            accessibilityLabel={[ch.label, ch.odds, ...ch.chips.map((x) => x.text)].join(', ')}
            onPress={() => {
              buzz();
              void chooseEvent(i);
            }}
            style={{
              borderWidth: 1.5,
              borderColor: 'transparent',
              backgroundColor: c.surface2,
              borderRadius: RADIUS.md,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <Txt style={{ fontWeight: '600' }}>{ch.label}</Txt>
              {ch.chips.length ? (
                <View
                  testID={`choice-chips-${i}`}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
                >
                  {ch.chips.map((x) => (
                    <PeekPill key={x.text} chip={x} />
                  ))}
                </View>
              ) : null}
            </View>
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: RADIUS.sm,
                backgroundColor: c.surface2,
                flexShrink: 0,
              }}
            >
              <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(FONT.body1) }}>{ch.odds}</Txt>
            </View>
          </Press>
        ))}
      </View>
      {s.legend.length ? (
        <View testID="event-legend" style={{ gap: 2 }}>
          {s.legend.map((l) => (
            <Txt
              key={l.term}
              style={{
                fontSize: rem(FONT.caption),
                color: c.muted,
                lineHeight: rem(FONT.caption) * 1.45,
              }}
            >
              <Txt style={{ fontSize: rem(FONT.caption), fontWeight: '700' }}>{l.term}</Txt>
              {` ${l.text}`}
            </Txt>
          ))}
        </View>
      ) : null}
    </>
  );
}

/** 선택지 득실 칩 하나(버튼 바탕과 구분되게 surface 바탕). 웹 .ec-chips .chip. */
function PeekPill({ chip }: { chip: PeekChip }) {
  const c = useColors();
  return (
    <View
      style={{
        borderRadius: RADIUS.pill,
        paddingVertical: 1,
        paddingHorizontal: 7,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: chip.tone === 'risk' ? c.line : 'transparent',
      }}
    >
      <Txt
        style={{
          fontSize: rem(FONT.caption),
          fontWeight: '600',
          color: chip.tone === 'up' ? c.good : chip.tone === 'down' ? c.bad : c.muted,
        }}
      >
        {chip.text}
      </Txt>
    </View>
  );
}
