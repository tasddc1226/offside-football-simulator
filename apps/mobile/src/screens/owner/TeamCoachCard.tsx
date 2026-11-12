import { View } from 'react-native';
import { FONT } from '@offside/app-core/design-tokens';
import type { OwnerTeam } from '@offside/app-core/api/team';
import type { FormationId } from '@offside/contracts/owner-team';
import { coachBreakdown, coachSummary } from '@offside/app-core/managerCard';
import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
import { DisclosureRow } from '../../ui/Disclosure';
import { Btn, Card, Txt } from '../../ui';
import { rem } from '../../theme/type';
import { go } from '../../game/nav';

type Props = {
  team: OwnerTeam;
  formation: FormationId;
  localNames: ReadonlyMap<string, string>;
  coachDetail: ReturnType<typeof coachBreakdown> | null;
  coachOpen: boolean;
  onToggle: () => void;
};
export function TeamCoachCard({
  team,
  formation,
  localNames,
  coachDetail,
  coachOpen,
  onToggle,
}: Props) {
  return (
    <Card gap={8} testID="team-coach">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt bold>{MG.teamCoach}</Txt>
          <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
            {team.coach ? coachSummary(team.coach, formation, localNames) : MG.teamCoachEmpty}
          </Txt>
        </View>
        <Btn sm testID="team-coach-manage" onPress={() => go('manager')}>
          {MG.teamCoachManage}
        </Btn>
      </View>
      {coachDetail ? (
        <>
          <DisclosureRow
            open={coachOpen}
            onToggle={onToggle}
            label={MG.breakdown}
            testID="team-coach-breakdown"
          />
          {coachOpen ? (
            <View style={{ gap: 8 }}>
              {coachDetail.rows.map((r) => (
                <View key={r.line} style={{ gap: 2 }} testID={`coach-line-${r.line}`}>
                  <Txt bold>
                    {r.label} {r.total}
                  </Txt>
                  <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                    {r.parts}
                  </Txt>
                  {r.capped ? <Txt style={{ fontSize: rem(FONT.label) }}>{r.capped}</Txt> : null}
                </View>
              ))}
              {coachDetail.off.length ? (
                <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                  {MG.breakdownOff({ names: coachDetail.off.join(' · ') })}
                </Txt>
              ) : null}
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                {MG.breakdownNote}
              </Txt>
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
