// 이벤트 선택 시트(웹 sheets/EventChoice.svelte): 스토리 표시 · 눈썹 · 제목 · 본문 · 선택지(확률 표시).
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
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
            borderRadius: 999,
            backgroundColor: mixColor(c.accent, c.surface, 16),
            borderWidth: 1,
            borderColor: alpha(c.accent, 0.55),
          }}
        >
          <Txt style={{ fontSize: rem(0.75), fontWeight: '600' }}>
            {`${L.storyTag({ name: s.story.name })} `}
            <Txt
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(0.875),
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
            accessibilityLabel={`${ch.label}, ${ch.odds}${ch.hint ? `, ${ch.hint}` : ''}`}
            onPress={() => {
              buzz();
              void chooseEvent(i);
            }}
            style={{
              borderWidth: 1.5,
              borderColor: c.line,
              backgroundColor: c.surface,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Txt style={{ flex: 1, fontWeight: '600' }}>{ch.label}</Txt>
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: c.surface2,
                flexShrink: 0,
              }}
            >
              <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(0.9375) }}>{ch.odds}</Txt>
            </View>
          </Press>
        ))}
      </View>
    </>
  );
}
