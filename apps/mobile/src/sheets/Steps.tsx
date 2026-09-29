// 진행 단계 시트(웹 sheets/Steps.svelte): 제목 · 채워지는 막대 · 단계 목록(지금 ▸ · 지난 ✓).
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';
import { ProgBar } from './parts';

export function Steps({ v }: { v: Extract<SheetView, { kind: 'steps' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  return (
    <>
      <Txt v="eyebrow">{s.title}</Txt>
      <ProgBar progress={s.progress} fill={s.fill} />
      <View style={{ gap: 6 }}>
        {s.steps.map((t, i) => {
          const on = i === s.active;
          const done = i < s.active;
          return (
            <Txt
              key={i}
              tone={on ? 'ink' : 'muted'}
              style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.55 }}
            >
              {on ? <Txt style={{ color: c.accent }}>{'▸ '}</Txt> : null}
              {done ? <Txt style={{ color: c.good }}>{'✓ '}</Txt> : null}
              {t}
            </Txt>
          );
        })}
      </View>
    </>
  );
}
