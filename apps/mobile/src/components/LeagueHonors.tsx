// T-11-640 리그 우승 기록(웹 league/LeagueHonors.svelte): 명예관 · 구단주 프로필 · 팀 프로필이 함께 쓴다. 없으면 그리지 않는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { View } from 'react-native';
import type { LeagueHonor } from '@offside/app-core/api/league';
import { leagueText as L } from '@offside/app-core/i18n/ko/league';
import { leagueHonorPlate, leagueTitle } from '@offside/app-core/leagueView';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Card } from '../ui/Card';
import { LeagueTrophy } from '../ui/LeagueArt';
import { Txt } from '../ui/Txt';

export function LeagueHonors({ honors }: { honors: readonly LeagueHonor[] }) {
  const c = useColors();
  if (!honors.length) return null;
  return (
    <Card gap={10} testID="league-honors">
      <View>
        <Txt v="eyebrow">Offside League</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.honorsTitle}
        </Txt>
      </View>
      <View style={{ gap: 8 }}>
        {honors.map((h) => (
          <View
            key={h.season}
            testID={`league-honor-${h.season}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: RADIUS.md,
              backgroundColor: c.surface2,
            }}
          >
            <LeagueTrophy tier={h.tier} league={h.league} name={leagueHonorPlate(h)} size={60} />
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Txt bold>{L.honorChampion({ title: leagueTitle(h) })}</Txt>
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                {`${teamSeasonLabel(h.season)} · ${h.teamName}`}
              </Txt>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
