// T-11-675 은퇴 동기 비교(웹 RetireCohort.svelte와 같은 규칙): 같은 시즌 같은 포지션으로 은퇴한 선수 중 내 기록의 자리.
// 분포는 서버가 하루 한 번 만들고 이 화면은 한 번만 읽는다(10분 메모). 분포가 없거나 드는 기록이 없으면 그리지 않는다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import {
  cohortText,
  cohortTotalsOf,
  cohortView,
  loadRetireCohort,
  type CohortView,
} from '@offside/app-core/retireCohort';
import type { LegendView } from '@offside/app-core/state';
import { useColors } from '../../theme/useColors';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';

export function RetireCohort({ v }: { v: LegendView }) {
  const c = useColors();
  const [view, setView] = useState<CohortView | null>(null);
  useEffect(() => {
    let alive = true;
    void loadRetireCohort().then((cohort) => {
      if (alive) setView(cohortView(cohort, v.pos, cohortTotalsOf(v)));
    });
    return () => {
      alive = false;
    };
    // 같은 선수의 은퇴 기록은 바뀌지 않으니 선수가 바뀔 때만 다시 고른다.
  }, [v]);
  if (!view) return null;
  const t = cohortText(view);
  return (
    <Card testID="retire-cohort" style={{ marginBottom: 16 }}>
      <Txt v="sm" bold accessibilityRole="header">
        {t.title}
      </Txt>
      <View style={{ gap: 6 }}>
        {t.lines.map((line) => (
          <View
            key={line.metric}
            testID={`retire-cohort-${line.metric}`}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: RADIUS.md,
            }}
          >
            <Txt style={{ flex: 1 }}>{line.label}</Txt>
            <Txt tone="muted">{line.value}</Txt>
            <Txt bold style={{ color: c.accent }}>
              {line.top}
            </Txt>
          </View>
        ))}
      </View>
      <Txt v="xs" tone="muted">
        {t.note}
      </Txt>
    </Card>
  );
}
