// T-11-034 업적 달성 알림 본문(웹 sheets/Achieve.svelte) — 등급 엠블럼(올랐으면 크게, 이전 → 지금), 새 업적과 얻은 점수,
// 지금 점수·다음 등급까지.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { GradeEmblem } from '../ui/GradeEmblem';
import { Txt } from '../ui/Txt';
import { Pop } from './anim';

const n = (x: number) => x.toLocaleString('ko-KR');

export function Achieve({ v }: { v: Extract<SheetView, { kind: 'achieve' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  return (
    <>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <View
        testID="ach-sheet"
        style={{ alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 10 }}
      >
        <Pop ms={500}>
          <GradeEmblem id={s.grade.id} size={s.from ? 96 : 64} />
        </Pop>
        <Txt v="h2" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {s.title}
        </Txt>
        {s.from ? (
          <View
            accessible
            accessibilityLabel={`${s.from.name}에서 ${s.grade.name}로`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <GradeEmblem id={s.from.id} size={20} />
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              {s.from.name}
            </Txt>
            <Txt tone="muted" style={{ fontSize: rem(0.875), marginHorizontal: 4 }}>
              →
            </Txt>
            <GradeEmblem id={s.grade.id} size={20} />
            <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>{s.grade.name}</Txt>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 6 }}>
        {s.items.map((it, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: c.surface2,
            }}
          >
            <Txt style={{ flexShrink: 1, fontSize: rem(0.875) }}>{it.label}</Txt>
            <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>+{n(it.gained)}</Txt>
          </View>
        ))}
        {s.more > 0 ? (
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: c.surface2,
            }}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              외 {s.more}개
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt tone="muted" style={{ fontSize: rem(0.8125), textAlign: 'center', marginTop: 8 }}>
        <Txt style={{ fontSize: rem(0.8125), fontWeight: '700' }}>+{n(s.gained)}점</Txt>
        {` · 지금 ${n(s.score)}점${s.next ? ` · ${s.next}` : ''}`}
      </Txt>
    </>
  );
}
