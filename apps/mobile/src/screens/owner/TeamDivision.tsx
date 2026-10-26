// T-11-375 팀 화면 머리의 디비전 카드(웹 team/TeamDivision.svelte) — 엠블럼 · 이름 · 다음 디비전까지 막대 · 받은 경기로 바뀐 디비전 알림.
import { useState } from 'react';
import { View } from 'react-native';
import { divisionHead, divisionRewardNote } from '@offside/app-core/teamDivision';
import { teamDivisionText as L } from '@offside/app-core/i18n/ko/teamDivision';
import { DivisionEmblem } from '../../components/DivisionEmblem';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';

export function TeamDivision({
  rating,
  division,
  season,
  notice = null,
}: {
  rating: number;
  division: number | undefined;
  season: number;
  notice?: string | null;
}) {
  const c = useColors();
  const [more, setMore] = useState(false);
  const v = divisionHead({ rating, division });
  if (!v) return null;
  const tone = v.guard ? c.bad : c.accent;
  return (
    <View style={{ gap: 6 }} testID="team-division">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 12,
          backgroundColor: c.surface2,
        }}
      >
        <DivisionEmblem division={v.division} size={34} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Txt v="xs" tone="muted">
              {L.label}
            </Txt>
            <Txt bold testID="team-division-name">
              {v.name}
            </Txt>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={v.aria}
            accessibilityValue={{ min: 0, max: 100, now: v.pct }}
            style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}
          >
            <View
              style={{ width: `${v.pct}%`, height: '100%', borderRadius: 3, backgroundColor: tone }}
            />
          </View>
          <Txt v="xs" tone={v.guard ? 'bad' : 'muted'} testID="team-division-line">
            {v.line}
          </Txt>
        </View>
      </View>
      {notice ? (
        <Txt v="sm" accessibilityLiveRegion="polite" testID="team-division-notice">
          {notice}
        </Txt>
      ) : null}
      <Press
        onPress={() => setMore((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
      >
        <Txt v="xs" tone="muted" style={{ textDecorationLine: 'underline' }}>
          {L.rewardTitle}
        </Txt>
      </Press>
      {more ? (
        <Txt v="xs" tone="muted">
          {divisionRewardNote(season)}
        </Txt>
      ) : null}
    </View>
  );
}
