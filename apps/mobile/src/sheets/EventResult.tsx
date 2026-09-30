// 이벤트 결과 시트(웹 sheets/EventResult.svelte): 큰 결과 · 탭 타이밍 · 본문 · 변화 칩 · 반전 · 도감 새 항목 · 스토리.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from '../ui/Txt';
import { Pop } from './anim';
import { Chips } from './Chips';
import { mixColor } from './parts';

export function EventResult({ v }: { v: Extract<SheetView, { kind: 'eventResult' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  return (
    <>
      <Txt v="eyebrow">{`결과 · ${s.label}`}</Txt>
      <Pop ms={350} style={{ alignSelf: 'flex-start' }}>
        <Txt
          style={{
            fontFamily: DISPLAY[700],
            fontSize: rem(2.5),
            lineHeight: rem(2.5),
            color: s.ok ? c.good : c.bad,
          }}
        >
          {s.outcome}
        </Txt>
      </Pop>
      {s.timing ? (
        <Txt
          testID="mg-timing"
          tone="muted"
          style={{ marginTop: -6, fontSize: rem(0.8125), fontWeight: '700' }}
        >
          {s.timing}
        </Txt>
      ) : null}
      <Txt>{s.text}</Txt>
      <Chips chips={s.chips} pop />
      {s.twist ? (
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.line,
          }}
        >
          <Txt style={{ fontSize: rem(0.8125) }}>{s.twist}</Txt>
        </View>
      ) : null}
      {s.dexNew ? (
        <View
          testID="dex-new"
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: mixColor(c.accent, c.surface, 12),
            borderWidth: 1,
            borderColor: alpha(c.accent, 0.45),
          }}
        >
          <Txt style={{ fontSize: rem(0.8125) }}>
            {'📖 도감 새 항목 · '}
            <Txt style={{ fontSize: rem(0.8125), fontWeight: '700' }}>{s.dexNew}</Txt>
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              {' — 홈의 확률 도감에서 볼 수 있어요'}
            </Txt>
          </Txt>
        </View>
      ) : null}
      {s.story ? (
        s.story.ending ? (
          <View
            style={{
              gap: 2,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: mixColor(c.accent, c.surface, 12),
              borderWidth: 1,
              borderColor: alpha(c.accent, 0.5),
            }}
          >
            <Txt v="eyebrow">{`스토리 완결 · ${s.story.name}`}</Txt>
            <Txt style={{ fontSize: rem(1.0625), fontWeight: '700' }}>{s.story.ending}</Txt>
          </View>
        ) : (
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: c.surface2,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: c.line,
            }}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              {s.story.started ? (
                <>
                  {'새 스토리 시작: '}
                  <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '700' }}>
                    {s.story.name}
                  </Txt>
                  {' — '}
                </>
              ) : null}
              {'이 이야기는 다음에 이어집니다…'}
            </Txt>
          </View>
        )
      ) : null}
    </>
  );
}
