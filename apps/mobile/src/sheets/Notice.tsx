// 안내 시트 본문(웹 sheets/Notice.svelte): 눈썹 · 제목 · 큰 결과 · 단계 목록 · 문단 · 확인 칸.
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from '../ui/Txt';

export function Notice({ v }: { v: Extract<SheetView, { kind: 'notice' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const [checked, setChecked] = useState(false);
  return (
    <>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      {s.title ? (
        <Txt v="h2" accessibilityRole="header">
          {s.title}
        </Txt>
      ) : null}
      {s.big ? (
        <Txt
          style={{
            fontFamily: DISPLAY[700],
            fontSize: rem(2.5),
            lineHeight: rem(2.5),
            color: s.big.ok ? c.good : c.bad,
          }}
        >
          {s.big.text}
        </Txt>
      ) : null}
      {s.steps ? (
        <View style={{ gap: 4 }}>
          {s.steps.map((t, i) => (
            <Txt key={i}>{`${i + 1}. ${t}`}</Txt>
          ))}
        </View>
      ) : null}
      {s.text ? <Txt tone={s.muted ? 'muted' : 'ink'}>{s.text}</Txt> : null}
      {s.check ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch
            value={checked}
            onValueChange={(on) => {
              setChecked(on);
              v.check?.onChange(on);
            }}
            accessibilityLabel={s.check.label}
          />
          <Txt style={{ flex: 1 }}>{s.check.label}</Txt>
        </View>
      ) : null}
    </>
  );
}
