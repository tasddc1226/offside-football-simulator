// 판정 게이지 시트(웹 sheets/Judge.svelte): 성공 확률 막대 위에서 바늘이 흔들리다 판정값에 멈춘다.
// 바늘 위치(v.pos)는 sheet-controller가 시간에 맞춰 고친다 — 여기서는 읽어 그리기만 한다.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';

export function Judge({ v }: { v: Extract<SheetView, { kind: 'judge' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const pct = Math.round(s.p * 100);
  return (
    <>
      <Txt v="eyebrow">판정 중</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.label}
      </Txt>
      <View style={{ height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${s.p * 100}%`, backgroundColor: alpha(c.good, 0.55) }} />
        <View style={{ flex: 1, backgroundColor: alpha(c.bad, 0.45) }} />
        {/* 바늘: 굵기 3 + 양옆 2씩 surface 테두리(웹 box-shadow 0 0 0 2px). 위치는 바늘 왼쪽 -1px. */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${s.pos * 100}%`,
            marginLeft: -3,
            width: 7,
            borderWidth: 2,
            borderColor: c.surface,
            borderRadius: 4,
            backgroundColor: c.ink,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 }}>
        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>{`성공 ${pct}%`}</Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>{`실패 ${100 - pct}%`}</Txt>
      </View>
    </>
  );
}
